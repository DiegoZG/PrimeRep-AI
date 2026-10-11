import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadTypescript(relative, mocks = {}, cache = new Map()) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports, Date, JSON, Promise, Set, Map, console, setTimeout, clearTimeout,
    require: (name) => {
      if (name in mocks) return mocks[name];
      const resolved = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      if (!name.startsWith("@/") && !name.startsWith(".")) throw new Error(`Unexpected import: ${name}`);
      return loadTypescript(path.relative(root, `${resolved}.ts`), mocks, cache);
    },
  }, { filename });
  return module.exports;
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function fixture(options = {}) {
  const memory = new Map(), reads = [];
  let failWrite = false;
  const AsyncStorage = {
    getItem: async (key) => { reads.push(key); return options.read?.(key) ?? memory.get(key) ?? null; },
    setItem: async (key, value) => { await options.write?.(key, value); if (failWrite) throw new Error("offline"); memory.set(key, value); },
    removeItem: async (key) => { memory.delete(key); },
  };
  const AuthContext = React.createContext(null);
  const load = (relative, mocks) => {
    const filename = path.join(root, relative), module = { exports: {} };
    const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(output, { module, exports: module.exports, Promise, console, require: (name) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import ${name}`);
    } }, { filename });
    return module.exports;
  };
  const store = load("utils/workoutLayoutPreference.ts", { "@react-native-async-storage/async-storage": AsyncStorage });
  const { WorkoutLayoutProvider, useWorkoutLayout } = load("utils/workoutLayoutContext.tsx", { react: React, "@/utils/authContext": { AuthContext }, "@/utils/workoutLayoutPreference": store });
  const { useSetSwipeHint } = load("utils/useSetSwipeHint.ts", { react: React, "@/utils/workoutLayoutPreference": store });
  let identity = { user: { id: "A" } }, latest, tree, eligible = false;
  const snapshots = [];
  const Probe = () => { latest = options.hint ? useSetSwipeHint(identity.user?.id ?? null, eligible) : useWorkoutLayout(); snapshots.push({ owner: identity.user?.id, layout: latest.layout, isReady: latest.isReady }); return React.createElement("Probe"); };
  const element = () => React.createElement(AuthContext.Provider, { value: identity }, React.createElement(WorkoutLayoutProvider, null, React.createElement(Probe)));
  const mount = async () => { await act(async () => { tree = create(element()); }); };
  const changeOwner = async (id) => { identity = { user: id ? { id } : null }; await act(async () => { tree.update(element()); }); };
  return { store, memory, reads, snapshots, mount, changeOwner,
    setEligible: async (value) => { eligible = value; await act(async () => tree.update(element())); },
    remount: async () => { await act(async () => tree.unmount()); await mount(); },
    get latest() { return latest; }, setFailWrite(value) { failWrite = value; }, unmount: async () => { await act(async () => tree.unmount()); } };
}

test("workout layout defaults to Focus and stays separate for each account", async () => {
  const view = fixture(); await view.mount();
  assert.deepEqual([view.latest.layout, view.latest.isReady], ["focus", true]);
  await act(async () => { await view.latest.setLayout("all"); });
  assert.equal(view.memory.get("@primerep/workout-layout/A"), "all");
  await view.changeOwner("B");
  assert.deepEqual([view.latest.layout, view.latest.isReady], ["focus", true]);
  assert.equal(view.snapshots.some((snapshot) => snapshot.owner === "B" && snapshot.layout === "all"), false);
  await view.changeOwner("A"); assert.equal(view.latest.layout, "all");
  await view.changeOwner(null); await view.changeOwner("A"); assert.equal(view.latest.layout, "all");
  await view.unmount();
});

test("workout layout invalid data falls back to Focus and failed writes roll back", async () => {
  const view = fixture(); view.memory.set("@primerep/workout-layout/A", "unknown"); await view.mount();
  assert.equal(view.latest.layout, "focus");
  view.setFailWrite(true);
  await act(async () => { await assert.rejects(view.latest.setLayout("all"), /offline/); });
  assert.equal(view.latest.layout, "focus"); assert.equal(view.latest.isSaving, false);
  assert.equal(view.memory.get("@primerep/workout-layout/A"), "unknown");
  await view.unmount();
});

test("late account A hydration cannot display A's layout for account B", async () => {
  const waiting = deferred();
  const view = fixture({ read: (key) => key.endsWith("/A") ? waiting.promise : null });
  await view.mount();
  await view.changeOwner("B");
  await act(async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); });
  assert.deepEqual([view.latest.layout, view.latest.isReady], ["focus", true]);
  await act(async () => waiting.resolve("all"));
  assert.deepEqual([view.latest.layout, view.latest.isReady], ["focus", true]);
  assert.equal(view.snapshots.some((snapshot) => snapshot.owner === "B" && snapshot.layout === "all"), false);
  await view.unmount();
});

test("a captured Settings action from A cannot change B or a later A session", async () => {
  const view = fixture(); await view.mount();
  const staleSetLayout = view.latest.setLayout;
  await view.changeOwner("B");
  await act(async () => { await staleSetLayout("all"); });
  assert.equal(view.latest.layout, "focus");
  assert.equal(view.memory.has("@primerep/workout-layout/B"), false);
  await view.changeOwner("A");
  await act(async () => { await staleSetLayout("all"); });
  assert.equal(view.latest.layout, "focus");
  assert.equal(view.memory.has("@primerep/workout-layout/A"), false);
  await act(async () => { await view.latest.setLayout("all"); });
  assert.equal(view.latest.layout, "all");
  await view.unmount();
});

test("late failed save from A cannot roll back B or report B's setting as failed", async () => {
  const waiting = deferred();
  const view = fixture({ write: (key) => key.endsWith("/A") ? waiting.promise : undefined });
  await view.mount();
  view.setFailWrite(true);
  let saving;
  await act(async () => { saving = view.latest.setLayout("all"); });
  await view.changeOwner("B");
  assert.equal(view.latest.layout, "focus");
  await act(async () => waiting.resolve());
  await saving;
  assert.deepEqual([view.latest.layout, view.latest.isReady, view.latest.isSaving], ["focus", true, false]);
  await view.unmount();
});

test("account deletion removes its preference and fences later writes", async () => {
  const view = fixture();
  await view.store.saveWorkoutLayout("A", "all");
  await view.store.markSetSwipeHintSeen("A");
  await view.store.clearWorkoutLayoutForUser("A");
  assert.equal(await view.store.loadWorkoutLayout("A"), "focus");
  await assert.rejects(view.store.saveWorkoutLayout("A", "all"), /deleted/);
  assert.equal(view.memory.has("@primerep/workout-layout/A"), false);
  await view.store.markSetSwipeHintSeen("A");
  assert.equal(await view.store.loadSetSwipeHintSeen("A"), false);
});

test("swipe education waits until eligible, remembers presentation, and stays separate per account", async () => {
  const view = fixture({ hint: true }); await view.mount();
  try {
    await act(async () => view.latest.request());
    assert.equal(view.latest.visible, false);
    await view.setEligible(true);
    assert.equal(view.latest.visible, true);
    await act(async () => view.latest.dismiss());
    assert.equal(view.latest.visible, false);
    await view.remount();
    await act(async () => view.latest.request());
    assert.equal(view.latest.visible, false);
    await view.changeOwner("B");
    assert.equal(view.latest.visible, false);
    await act(async () => view.latest.request());
    assert.equal(view.latest.visible, true);
    await view.changeOwner("A");
    assert.equal(view.latest.visible, false);
  } finally { await view.unmount(); }
});

test("a late hint read and captured callbacks cannot affect a later account epoch", async () => {
  const waiting = deferred();
  const view = fixture({ hint: true, read: (key) => key.endsWith("/A/set-swipe-hint") ? waiting.promise : null });
  await view.mount();
  try {
    const old = view.latest;
    await view.setEligible(true);
    await view.changeOwner("B");
    await act(async () => { old.request(); old.dismiss(); });
    assert.equal(view.latest.visible, false);
    assert.equal(await view.store.loadSetSwipeHintSeen("B"), false);
    await view.changeOwner("A");
    await act(async () => { old.request(); waiting.resolve(null); });
    assert.equal(view.latest.visible, false);
    await act(async () => view.latest.request());
    assert.equal(view.latest.visible, true);
  } finally { waiting.resolve(null); await view.unmount(); }
});

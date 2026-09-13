import path from "node:path";
import { spawnSync } from "node:child_process";

const auditScript = path.resolve("scripts/audit-ui-actions.mjs");
const fixtureRoot = path.resolve("scripts/fixtures/ui-action-audit");

function runFixture(name) {
  return spawnSync(process.execPath, [auditScript], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, UI_AUDIT_ROOTS: path.join(fixtureRoot, name) },
  });
}

const invalid = runFixture("invalid");
const invalidOutput = `${invalid.stdout}${invalid.stderr}`;
const noOpMatches = invalidOutput.match(/empty, no-op, or undefined onPress/g) ?? [];
const expectedFailures = [
  "has no onPress or href",
  "appears icon-only but has no accessibilityLabel",
  "is disabled without accessibilityState",
];
if (invalid.status === 0 || noOpMatches.length !== 2 || expectedFailures.some((message) => !invalidOutput.includes(message))) {
  console.error("UI audit invalid fixture did not report every expected failure.");
  console.error(invalidOutput);
  process.exit(1);
}

const valid = runFixture("valid");
if (valid.status !== 0) {
  console.error("UI audit rejected its valid fixture.");
  console.error(`${valid.stdout}${valid.stderr}`);
  process.exit(1);
}

console.log("UI interaction audit self-tests passed.");

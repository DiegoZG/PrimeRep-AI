import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, mocks = {}, globals = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const fallback = createRequire(filename);
  const require = (name) => name in mocks ? mocks[name] : fallback(name);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console, React, ...globals }, { filename });
  return module.exports;
}

const dashboard = load("utils/homeDashboard.ts", {
  "@/utils/coachNavigation": { coachTargetHref: (target) => target?.type === "none" || !target?.type ? null : "/destination" },
});
const target = { type: "planned_workout", workoutDayId: "w-1", weekStart: "2026-09-21" };

test("local active workout outranks Coach and a completed carousel card is never guessed as next", () => {
  const planned = { type: "planned_workout", title: "Friday", body: "", target };
  assert.equal(dashboard.homeWorkoutState(true, planned, 3), "resume");
  assert.equal(dashboard.homeWorkoutState(false, planned, 3), "planned");
  assert.equal(dashboard.homeWorkoutState(false, null, 3), "unavailable");
  assert.equal(dashboard.homeWorkoutState(false, { type: "caught_up", target: { type: "none" } }, 0), "first");
  assert.equal(dashboard.homeWorkoutState(false, { type: "caught_up", target: { type: "none" } }, null), "unavailable");
  assert.equal(dashboard.homeWorkoutState(false, { type: "caught_up", target: { type: "none" } }, 4), "complete");
});

test("Home chooses only the highest-priority unread Coach item with a usable destination", () => {
  const item = (id, priority, readAt, targetType = "planned_workout") => ({ id, priority, readAt, createdAt: "2026-09-25", target: targetType === "none" ? { type: "none" } : target });
  assert.equal(dashboard.selectHomeCoachItem([
    item("read", 100, "2026-09-25"), item("no-link", 90, null, "none"), item("lower", 20, null), item("best", 60, null),
  ])?.id, "best");
  assert.equal(dashboard.selectHomeCoachItem([item("read", 100, "2026-09-25")]), null);
});

test("trend uses the last four server Monday weeks, including the partial current week", () => {
  const weeks = ["2026-08-24", "2026-09-21", "2026-09-07", "2026-09-14", "2026-08-31"]
    .map((week_start, index) => ({ week_start, completed_workouts: index, is_current: week_start === "2026-09-21" }));
  const result = dashboard.fourWeekActivity({ weekly_activity: weeks });
  assert.deepEqual(Array.from(result, (week) => week.week_start), ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"]);
  assert.equal(result[3].is_current, true);
});

test("Home and Coach share unit-aware, equipment-aware target copy", () => {
  let args;
  const presentation = load("utils/coachItemBody.ts", {
    "@/utils/attainableLoads": { resolveFriendlyLoad: (value) => { args = value; return { displayText: "55 lb", adjustmentNote: null }; } },
  }).coachItemPresentation;
  const item = { body: "Your next target is 25 kg.", weightData: { context: "target", exerciseName: "Calf Raise", weightKg: 25, equipmentIds: ["dumbbells"], recommendation: "increase" } };
  assert.equal(presentation(item, "LB", [5, 10, 20], [5, 10]).body, "Your next Calf Raise target is 55 lb.");
  assert.equal(args.weightUnit, "LB");
  assert.deepEqual(Array.from(args.equipmentIds), ["dumbbells"]);
});

test("a durable local workout appears before the offline server request settles", async () => {
  let finishServerRequest;
  const serverRequest = new Promise((resolve) => { finishServerRequest = resolve; });
  const AuthContext = React.createContext({ token: "token-a", user: { id: "user-a" } });
  const active = load("utils/activeWorkoutContext.tsx", {
    "react": React,
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "@/services/workoutLoggingService": { getActiveSession: () => serverRequest, getSession: async () => null },
    "@/utils/activeWorkoutStore": {
      loadActiveWorkout: async () => ({
        serverSessionId: null,
        workoutDayId: "day-a",
        dayType: "full_body",
        workoutSnapshot: { title: "Offline workout", blocks: [] },
        startedAt: 1,
        sets: [],
      }),
      clearActiveWorkout: async () => {},
    },
    "@/utils/authContext": { AuthContext },
  });
  let latest = null;
  function Probe() { latest = active.useActiveWorkout().activeWorkout; return null; }
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(AuthContext.Provider, { value: { token: "token-a", user: { id: "user-a" } } }, React.createElement(active.ActiveWorkoutProvider, null, React.createElement(Probe))));
    await Promise.resolve();
  });
  assert.equal(latest?.title, "Offline workout");
  finishServerRequest(null);
  await act(async () => { await serverRequest; });
  assert.equal(latest?.title, "Offline workout");
  await act(async () => { renderer.unmount(); });
});

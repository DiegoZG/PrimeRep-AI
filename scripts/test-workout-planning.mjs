import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const planning = loadTypescript("utils/workoutPlanning.ts", {});
const workout = { workoutDayId: "day-A", durationMinutes: 35, blocks: [{ items: [{}, {}] }] };

test("legacy workout summaries keep a time budget while trainer-led summaries lead with exercises", () => {
  assert.equal(planning.workoutPlanningSummary(workout), "Up to 35 min");
  const trainer = { ...workout, planningMode: "trainer_led", timeBudgetMinutes: null, durationMinutes: 70 };
  assert.equal(planning.workoutPlanningSummary(trainer), "2 exercises");
  assert.equal(planning.workoutTimeBudget(trainer), 35);
  assert.equal(planning.workoutPlanningSummary({ ...trainer, programActivationId: "program-A" }), "70 min");
  assert.equal(planning.workoutPlanningSummary({ ...workout, timeBudgetMinutes: 120, estimatedMinutes: 40 }), "Up to 120 min");
});

test("a trainer-led estimate of 50 minutes never becomes a time budget", () => {
  const trainer = { ...workout, planningMode: "trainer_led", timeBudgetMinutes: null, durationMinutes: 50, estimatedMinutes: 50 };
  assert.equal(planning.workoutTimeBudget(trainer), 35);
  assert.equal(planning.workoutPlanningSummary(trainer), "2 exercises");
});

test("week and session snapshot mapping retains explicit planning metadata and nullable budgets", () => {
  const service = loadTypescript("services/workoutWeekService.ts", { "./httpClient": { requestJson() {} } });
  const mapped = service.mapApiWorkoutDay({ ...workout, planningMode: "trainer_led", timeBudgetMinutes: null, planningSource: "override", planningEditable: false, estimatedMinutes: 55, exerciseBlocks: [] });
  assert.equal(mapped.planningMode, "trainer_led"); assert.equal(mapped.timeBudgetMinutes, null);
  assert.equal(mapped.estimatedMinutes, 55); assert.equal(mapped.planningSource, "override"); assert.equal(mapped.planningEditable, false);
  const legacy = service.mapApiWorkoutDay({ ...workout, exerciseBlocks: [] });
  assert.equal(legacy.planningMode, undefined); assert.equal(planning.workoutPlanningSummary(legacy), "Up to 35 min");
});

test("planning mutations send explicit modes and date context, and bulk apply maps its week response", async () => {
  const calls = []; const service = loadTypescript("services/workoutWeekService.ts", { "./httpClient": { requestJson: async (...args) => { calls.push(plain(args)); return args[0].endsWith("apply-planning-preference") ? { weekPlan: { weekStart: "2026-10-19", workouts: [] }, updatedWorkoutCount: 2, protectedWorkoutCount: 1 } : { weekStart: "2026-10-19", workouts: [] }; } } });
  const dates = { weekStart: "2026-10-19", effectiveDate: "2026-10-24" };
  await service.updateWorkoutPlanning("token-A", "day-A", { planningMode: "trainer_led", timeBudgetMinutes: null }, dates);
  assert.deepEqual(calls[0], ["/v1/workouts/week/planning", { method: "PATCH", token: "token-A", body: { workoutDayId: "day-A", planningMode: "trainer_led", timeBudgetMinutes: null, ...dates } }]);
  const applied = await service.applyWorkoutPlanningPreference("token-A", dates);
  assert.equal(applied.updatedWorkoutCount, 2); assert.equal(applied.protectedWorkoutCount, 1); assert.equal(applied.weekPlan.weekStart, dates.weekStart);
  assert.deepEqual(calls[1], ["/v1/workouts/week/apply-planning-preference", { method: "POST", token: "token-A", body: dates }]);
});

test("preference save opts into preserve without changing the existing training update contract", async () => {
  const calls = []; const service = loadTypescript("services/onboardingService.ts", { "./httpClient": { requestJson: async (...args) => { calls.push(plain(args)); return args[1].body; } } });
  const dates = { weekStart: "2026-10-19", effectiveDate: "2026-10-24" };
  await service.updateTrainingPreferences("token-A", { workoutPlanningMode: "trainer_led", preferredWorkoutMinutes: 90 }, { ...dates, planUpdateScope: "preserve" });
  assert.match(calls[0][0], /planUpdateScope=preserve$/);
  await service.updateTrainingPreferences("token-A", { workoutFrequency: "5-days" }, dates);
  assert.doesNotMatch(calls[1][0], /planUpdateScope/);
});

test("manual add uses a canonical source permutation and preserves its explicit over-budget choice", async () => {
  const calls = []; const service = loadTypescript("services/workoutWeekService.ts", { "./httpClient": { requestJson: async (...args) => { calls.push(plain(args)); return { weekStart: "2026-10-19", workouts: [] }; } } });
  const params = { workoutDayId: "day-A", exerciseId: "curl", expectedExerciseIds: ["bench", "row"], weekStart: "2026-10-19", effectiveDate: "2026-10-24", allowOverBudget: true };
  await service.addWorkoutExercise("token-A", params);
  assert.deepEqual(calls, [["/v1/workouts/week/exercises", { method: "POST", token: "token-A", body: params }]]);
  assert.equal(planning.workoutPlanningSummary({ ...workout, planningMode: "time_budget", timeBudgetMinutes: 35, estimatedMinutes: 65 }), "About 65 min · 35 min budget");
});

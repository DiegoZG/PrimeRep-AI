import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const schema = loadTypescript("services/workoutDiagnosticSchema.ts");
const { WorkoutDiagnostics } = loadTypescript("services/workoutDiagnostics.ts");
const bridge = loadTypescript("utils/workoutDiagnosticsBridge.ts");
const copy = (value) => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
let counter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
function harness(options = {}) {
  let now = options.now ?? 1_794_081_600_000;
  let current = true;
  const memory = options.memory ?? new Map();
  const batches = [], writes = [];
  const storage = { getItem: async (key) => options.read ? options.read(key) : memory.get(key) ?? null,
    setItem: async (key, value) => { writes.push(copy(JSON.parse(value))); if (options.write) await options.write(key, value); memory.set(key, value); } };
  const deps = { storage, uuid, runId: options.runId ?? uuid(), now: () => now, current: () => current, platform: options.platform ?? "ios", appVersion: options.version ?? "1.0.0", storageKey: options.key ?? "ownerA:preview",
    send: async (batch) => { batches.push(copy(batch)); return options.send ? options.send(batch) : { enabled: true, accepted: batch.events.length, duplicates: 0, discarded: 0 }; } };
  const runtime = new WorkoutDiagnostics(deps);
  return { runtime, memory, batches, writes, deps, advance: (ms) => { now += ms; }, setCurrent: (value) => { current = value; },
    start: async () => { runtime.setEnabled(true); await runtime.initialize(); await settle(); },
    events: () => writes.at(-1)?.events.map(({ event }) => event) ?? [] };
}
const operation = { id: "business-id-never-on-wire", type: "set" };
const queue = (operations = [operation], newIds = operations.map(({ id }) => id), at = 1_794_081_600_000) => ({ kind: "queue", operations, newIds, at });
const local = { kind: "local", outcome: "success", count: 1, duration: 4 };

test("v1 allowlist rejects private/unknown fields, invalid enums, numbers and invariants", () => {
  const valid = { event_id: uuid(), event_type: "local_save", occurred_at_ms: 1, outcome: "success", saved_count: 1 };
  assert.ok(schema.validEvent(valid));
  for (const extra of [{ reps: 8 }, { exerciseId: "private" }, { error: "raw" }, { duration_ms: 1.5 }, { occurred_at_ms: true }, { saved_count: 0 }, { outcome: "acknowledged" }, { error_category: "raw" }]) assert.equal(schema.validEvent({ ...valid, ...extra }), false);
  assert.equal(schema.validEvent({ event_id: uuid(), event_type: "sync_attempt", occurred_at_ms: 1 }), false);
  assert.equal(schema.validEvent({ event_id: uuid(), event_type: "queue_snapshot", occurred_at_ms: 1, queue_depth: 1, unknown_age_count: 2 }), false);
  assert.equal(schema.validEvent({ event_id: uuid(), event_type: "operation_terminal", occurred_at_ms: 1, trace_id: uuid(), operation_type: "set", outcome: "acknowledged" }), false);
  assert.equal(schema.validEvent({ ...valid, clock_invalid: true, queue_age_ms: 0 }), false);
});

test("disabled capture stays inert, including a pending coalesced gauge after rollback", async () => {
  const h = harness(); await h.runtime.initialize(); h.runtime.capture(local); h.runtime.tick(); await settle();
  assert.equal(h.events().length, 0); assert.equal(h.batches.length, 0);
  h.runtime.setEnabled(true); h.runtime.capture(queue()); h.runtime.capture(queue([operation, { id: "later", type: "set" }])); await settle();
  const before = h.events().length;
  h.runtime.setEnabled(false); h.advance(20_000); h.runtime.tick(); await settle();
  assert.equal(h.events().length, before); assert.equal(h.batches.length, 0);
});

test("sidecar preserves immutable trace and original queue age through rewrites and cold restart", async () => {
  const h = harness(); await h.start(); h.runtime.capture(queue()); await settle();
  const queued = h.events().find((event) => event.event_type === "operation_queued");
  h.advance(1_000); h.runtime.capture(queue([operation], [], h.deps.now())); await settle();
  const restart = harness({ memory: h.memory, now: h.deps.now() + 2_000 }); await restart.start();
  restart.runtime.capture({ kind: "terminal", operation, outcome: "acknowledged", acknowledgment: "reconciled" }); await settle();
  const terminal = restart.events().find((event) => event.event_type === "operation_terminal");
  assert.equal(terminal.trace_id, queued.trace_id); assert.equal(terminal.queue_age_ms, 3_000); assert.equal(terminal.recovered_after_restart, true);
  restart.runtime.capture({ kind: "terminal", operation, outcome: "acknowledged", acknowledgment: "direct" }); await settle();
  assert.equal(restart.events().filter((event) => event.event_type === "operation_terminal").length, 1);
});

test("legacy operations keep stable trace with unknown age; invalid clocks never fabricate zero", async () => {
  const h = harness(); await h.start(); h.runtime.capture(queue([operation], [])); await settle();
  h.runtime.capture({ kind: "terminal", operation, outcome: "acknowledged", acknowledgment: "reconciled" }); await settle();
  const legacy = h.events().find((event) => event.event_type === "operation_terminal");
  assert.equal(legacy.queue_age_ms, undefined); assert.equal(h.events().some((event) => event.event_type === "operation_queued"), false);
  const future = { id: "future", type: "set" }; h.runtime.capture(queue([future], [future.id], h.deps.now() + 1));
  h.runtime.capture({ kind: "terminal", operation: future, outcome: "acknowledged", acknowledgment: "direct" }); await settle();
  const invalid = h.events().filter((event) => event.event_type === "operation_terminal").at(-1);
  assert.equal(invalid.clock_invalid, true); assert.equal(invalid.queue_age_ms, undefined);
});

test("upgrade retains old buffered envelope and captures new observations under the new release", async () => {
  const h = harness(); await h.start(); h.runtime.capture(queue()); await settle();
  const next = harness({ memory: h.memory, version: "2.0.0", now: h.deps.now() + 2_000 }); await next.start();
  next.runtime.capture({ kind: "retry", operation, delay: 5_000 }); await settle();
  next.runtime.tick(); await settle(); next.advance(2_000); next.runtime.tick(); await settle();
  assert.equal(next.batches[0].app_version, "1.0.0");
  assert.ok(next.batches[1].events.some((event) => event.event_type === "retry_scheduled")); assert.equal(next.batches[1].app_version, "2.0.0");
});

test("compatible batches are capped, stable event IDs survive retry, one flight and foreground backoff", async () => {
  const gate = deferred(); let fail = true;
  const h = harness({ send: async (batch) => { await gate.promise; if (fail) throw { status: 503 }; return { enabled: true, accepted: batch.events.length, duplicates: 0, discarded: 0 }; } });
  await h.start(); for (let i = 0; i < 35; i++) h.runtime.capture(local); await settle();
  h.runtime.tick(); h.runtime.tick(); await settle(); assert.equal(h.batches.length, 1); assert.equal(h.batches[0].events.length, 20); assert.ok(schema.jsonBytes(h.batches[0]) <= 32 * 1024);
  gate.resolve(); await settle(); h.runtime.tick(); await settle(); assert.equal(h.batches.length, 1);
  h.runtime.setForeground(false); h.advance(5_000); h.runtime.tick(); await settle(); assert.equal(h.batches.length, 1);
  fail = false; h.runtime.setForeground(true); await settle(); assert.equal(h.batches.length, 2);
  assert.deepEqual(h.batches[0].events.map(({ event_id }) => event_id), h.batches[1].events.map(({ event_id }) => event_id));
});

test("flag-off receipt retires only the delivered batch and suspends until an enabled snapshot", async () => {
  const h = harness({ send: async (batch) => ({ enabled: false, accepted: 0, duplicates: 0, discarded: batch.events.length }) });
  await h.start(); for (let i = 0; i < 25; i++) h.runtime.capture(local); await settle(); h.runtime.tick(); await settle();
  assert.equal(h.events().length, 5); h.advance(60_000); h.runtime.tick(); await settle(); assert.equal(h.batches.length, 1);
  h.runtime.setEnabled(true); await settle(); assert.equal(h.batches.length, 2);
});

test("auth failures suspend delivery for the credential lifetime, even after repeated flag refresh", async () => {
  const h = harness({ send: async () => { throw { status: 401 }; } }); await h.start(); h.runtime.capture(local); h.runtime.tick(); await settle();
  h.advance(120_000); h.runtime.setEnabled(true); h.runtime.tick(); await settle(); assert.equal(h.batches.length, 1);
});

test("bounded outbox expires and drops oldest telemetry with a bounded gap signal", async () => {
  const h = harness(); await h.start(); for (let i = 0; i < 230; i++) h.runtime.capture(local); await settle();
  assert.ok(h.events().length <= 200); assert.ok(schema.jsonBytes(h.writes.at(-1)) <= 128 * 1024); assert.equal(h.writes.at(-1).dropped, 30);
  h.runtime.tick(); await settle(); assert.ok(h.writes.at(-1).events.some(({ event }) => event.event_type === "diagnostics_dropped"));
  h.runtime.setEnabled(false); h.advance(schema.TTL + 1); h.runtime.tick(); await settle(); assert.equal(h.events().length, 0);
});

test("corrupt storage and extra envelope data cannot leak through persisted or sent diagnostics", async () => {
  const h = harness({ memory: new Map([["ownerA:preview", "{broken"]]) }); await h.start(); h.runtime.capture(local); await settle(); assert.equal(h.writes.at(-1).dropped, 1);
  const stored = copy(h.writes.at(-1)); stored.events[0].private = "secret"; stored.events[0].event.raw_body = "private";
  stored.events.push({ platform: "ios", app_version: "1.0.0", captured_at: h.deps.now(), event: { event_id: uuid(), event_type: "local_save", occurred_at_ms: h.deps.now(), outcome: "success", saved_count: 1 }, extra: "secret" });
  const memory = new Map([["ownerA:preview", JSON.stringify(stored)]]); const next = harness({ memory }); await next.start(); next.runtime.tick(); await settle();
  assert.doesNotMatch(JSON.stringify(next.writes), /secret|private|raw_body/); assert.doesNotMatch(JSON.stringify(next.batches), /secret|private|raw_body/);
});

test("telemetry storage stalled or throwing remains separate and coalesces memory pressure", async () => {
  const gate = deferred(); const h = harness({ write: () => gate.promise }); await h.start();
  for (let i = 0; i < 500; i++) h.runtime.capture(local);
  await settle();
  assert.equal(h.writes.length, 1); gate.resolve(); await settle(); assert.ok(h.writes.length <= 3); assert.ok(h.events().length <= 200);
  const bad = harness({ write: () => { throw new Error("storage unavailable"); } }); await bad.start(); bad.runtime.capture(local); await settle(); assert.equal(bad.writes.length, 1); bad.advance(30_000); bad.runtime.tick(); await settle(); assert.equal(bad.writes.length, 2);
});

test("owner ABA fences discard old callbacks, responses, and diagnostics from another environment", async () => {
  const gate = deferred(); const h = harness({ send: () => gate.promise }); await h.start(); h.runtime.capture(queue()); h.runtime.tick(); await settle(); h.setCurrent(false);
  const next = harness({ memory: h.memory, key: "ownerB:production" }); await next.start(); next.runtime.capture(local); await settle();
  gate.resolve({ enabled: true, accepted: h.batches[0].events.length, duplicates: 0, discarded: 0 }); await settle();
  h.runtime.capture(local); h.advance(60_000); h.runtime.tick(); await settle(); assert.equal(h.batches.length, 1); assert.ok(h.memory.has("ownerA:preview")); assert.ok(next.memory.has("ownerB:production"));
});

test("pure bridge projects fixed fields, survives observer failure, and inactive calls preserve original promise", async () => {
  const promise = Promise.resolve("saved"); assert.equal(bridge.workoutDiagnostics("A").request(operation, () => promise), promise);
  let current = true; const signals = []; const remove = bridge.setWorkoutDiagnosticListener({ owner: "A", current: () => current, emit: (signal) => signals.push(copy(signal)) });
  const observer = bridge.workoutDiagnostics("A"); observer.queue([{ ...operation, payload: { reps: 999, token: "secret" } }], []);
  await observer.request(operation, () => Promise.resolve("ok")); assert.doesNotMatch(JSON.stringify(signals), /reps|token|secret|payload/);
  current = false; const count = signals.length; observer.emit(local); assert.equal(signals.length, count); remove();
  const stop = bridge.setWorkoutDiagnosticListener({ owner: "A", current: () => true, emit: () => { throw new Error("fail"); } });
  assert.equal(await bridge.workoutDiagnostics("A").request(operation, () => Promise.resolve("saved")), "saved"); stop();
});

test("safe transport categories include actual HttpError wrapper shape without reading raw messages", () => {
  for (const [error, category] of [[{ name: "HttpError" }, "network"], [{ name: "HttpError", isTimeout: true }, "timeout"], [{ status: 401 }, "auth"], [{ status: 429 }, "rate_limited"], [{ status: 503 }, "server"], [{ status: 409 }, "admission_conflict"], [{ status: 422 }, "validation"], [new Error("arbitrary"), "unknown"]]) assert.equal(bridge.diagnosticError(error).category, category);
});

test("idle foreground and flag-off ticks do not rewrite an unchanged diagnostic sidecar", async () => {
  const h = harness({ key: "idle" }); await h.start(); h.runtime.capture(local); await settle(); h.runtime.setEnabled(false);
  const count = h.writes.length;
  for (let i = 0; i < 100; i++) { h.advance(2_000); h.runtime.tick(); await settle(); }
  assert.equal(h.writes.length, count); assert.equal(h.batches.length, 0);
});

test("same-key A1 write completing after token refresh cannot overwrite A2 data", async () => {
  const gate = deferred(), started = deferred(); const memory = new Map(); let writes = 0;
  const first = harness({ key: "same-owner-env", memory, write: async () => { writes++; started.resolve(); await gate.promise; } });
  await first.start(); first.runtime.capture(queue()); await started.promise;
  first.setCurrent(false);
  const second = harness({ key: "same-owner-env", memory, version: "2.0.0" });
  let initialized = false; const initializing = second.start().then(() => { initialized = true; }); await settle();
  assert.equal(initialized, false); assert.equal(writes, 1);
  gate.resolve(); await initializing; second.runtime.capture(local); await settle();
  const stored = JSON.parse(memory.get("same-owner-env"));
  assert.ok(stored.events.some(({ event }) => event.event_type === "operation_queued"));
  assert.ok(stored.events.some(({ event }) => event.event_type === "local_save"));
  first.runtime.capture(local); await settle();
  assert.equal(JSON.parse(memory.get("same-owner-env")).events.length, stored.events.length);
});

test("stalled startup reads bound pending capture bytes and report observation gaps after recovery", async () => {
  const gate = deferred(); const h = harness({ key: "startup-byte-bound", read: () => gate.promise });
  h.runtime.setEnabled(true); const initializing = h.runtime.initialize();
  const large = Array.from({ length: 1_000 }, (_, index) => ({ id: `pending-${index}-${"x".repeat(80)}`, type: "set" }));
  for (let i = 0; i < 500; i++) h.runtime.capture(queue(large, []));
  assert.ok(h.runtime.waitingBytes <= 128 * 1024); assert.ok(h.runtime.waiting.length <= 200); assert.ok(h.runtime.waitingDropped > 0);
  gate.resolve(null); await initializing; await settle(); assert.ok(schema.jsonBytes(h.writes.at(-1)) <= 128 * 1024); assert.ok(h.writes.at(-1).dropped > 0);
});

test("active sidecar traces retain original age beyond telemetry TTL while pending within the metadata bound", async () => {
  const h = harness({ key: "long-offline" }); await h.start(); h.runtime.capture(queue()); await settle();
  const trace = h.events().find((event) => event.event_type === "operation_queued").trace_id;
  h.runtime.setEnabled(false); h.advance(schema.TTL + 1); h.runtime.tick(); await settle();
  const next = harness({ key: "long-offline", memory: h.memory, now: h.deps.now() }); await next.start();
  next.runtime.capture({ kind: "terminal", operation, outcome: "acknowledged", acknowledgment: "reconciled" }); await settle();
  const terminal = next.events().find((event) => event.event_type === "operation_terminal");
  assert.equal(terminal.trace_id, trace); assert.equal(terminal.queue_age_ms, schema.TTL + 1);
});

test("credential actor rebind in the same JS process is not reported as restart recovery", async () => {
  const runId = uuid(); const h = harness({ key: "token-rebind", runId }); await h.start(); h.runtime.capture(queue()); await settle(); h.setCurrent(false);
  const next = harness({ key: "token-rebind", memory: h.memory, runId }); await next.start();
  next.runtime.capture({ kind: "terminal", operation, outcome: "acknowledged", acknowledgment: "direct" }); await settle();
  assert.equal(next.events().find((event) => event.event_type === "operation_terminal").recovered_after_restart, false);
});

for (const interruption of ["flag_off", "background", "logout"]) {
  test(`deferred dispatch cancelled by ${interruption} sends nothing and schedules no failure/backoff`, async () => {
    const h = harness({ key: `dispatch-${interruption}` }); await h.start();
    h.runtime.capture(local); await settle();
    const before = h.events().length;
    h.runtime.tick();
    if (interruption === "flag_off") h.runtime.setEnabled(false);
    else if (interruption === "background") h.runtime.setForeground(false);
    else h.setCurrent(false);
    await settle();
    assert.equal(h.batches.length, 0); assert.equal(h.events().length, before);
    assert.equal(h.runtime.failures, 0); assert.equal(h.runtime.nextSendAt, 0); assert.equal(h.runtime.sending, false);
    if (interruption === "flag_off") h.runtime.setEnabled(true);
    else if (interruption === "background") h.runtime.setForeground(true);
    else { h.runtime.tick(); await settle(); assert.equal(h.batches.length, 0); return; }
    await settle(); assert.equal(h.batches.length, 1);
  });
}

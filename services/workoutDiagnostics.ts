import { jsonBytes, MAX_BATCH_BYTES, MAX_BYTES, MAX_EVENTS, TTL, validEvent, validRelease, validUuid } from "./workoutDiagnosticSchema";
import type { DiagnosticBatch, DiagnosticEvent, DiagnosticPlatform, DiagnosticReceipt } from "./workoutDiagnosticSchema";
import { projectDiagnosticSignal } from "@/utils/workoutDiagnosticsBridge";
import type { DiagnosticOperation, DiagnosticSignal } from "@/utils/workoutDiagnosticsBridge";

type Envelope = { platform: DiagnosticPlatform; app_version: string; captured_at: number; event: DiagnosticEvent };
type Trace = { id: string; type: DiagnosticOperation["type"]; first?: number; observed: number; run: string; platform: DiagnosticPlatform; app_version: string; terminal?: boolean; retiredAt?: number; attempts: number };
type Stored = { version: 1; events: Envelope[]; traces: Record<string, Trace>; dropped: number };
export interface DiagnosticDependencies {
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
  uuid(): string; now(): number; current(): boolean; runId: string;
  send(batch: DiagnosticBatch): Promise<DiagnosticReceipt>;
  platform: DiagnosticPlatform; appVersion: string; storageKey: string;
}
const storageFlights = new Map<string, Promise<unknown>>();
const empty = (): Stored => ({ version: 1, events: [], traces: Object.create(null), dropped: 0 });
const bounded = (value: number, max = 1_000_000) => Math.max(0, Math.min(max, Math.round(value)));
function envelope(value: unknown): value is Envelope {
  const data = value as Envelope | null;
  return Boolean(data && ["ios", "android", "web"].includes(data.platform) && validRelease(data.app_version) && Number.isSafeInteger(data.captured_at) && data.captured_at >= 0 && validEvent(data.event));
}

export class WorkoutDiagnostics {
  private state: Stored = empty();
  private ready = false;
  private waiting: DiagnosticSignal[] = [];
  private waitingBytes = 0;
  private waitingDropped = 0;
  private enabled = false;
  private foreground = true;
  private blocked: "auth" | "flag" | null = null;
  private sending = false;
  private writing = false;
  private dirty = false;
  private writeRetryAt = 0;
  private nextSendAt = 0;
  private failures = 0;
  private run: string;
  private lastSnapshot = -Infinity;
  private pendingSnapshot: { depth: number; unknown: number } | null = null;
  private player = false;
  constructor(private deps: DiagnosticDependencies) { this.run = deps.runId; }
  async initialize() {
    try {
      await storageFlights.get(this.deps.storageKey)?.catch(() => {});
      if (!this.deps.current()) return;
      const raw = await this.deps.storage.getItem(this.deps.storageKey);
      if (!this.deps.current()) return;
      if (raw) {
        if (raw.length > MAX_BYTES) throw new Error("Oversized diagnostics");
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !Array.isArray(parsed.events) || !parsed.traces || typeof parsed.traces !== "object" || Array.isArray(parsed.traces)) throw new Error("Invalid diagnostics");
        this.state.events = parsed.events.filter(envelope).slice(-MAX_EVENTS).map((item: Envelope) => ({ platform: item.platform, app_version: item.app_version, captured_at: item.captured_at, event: { ...item.event } }));
        this.state.dropped = bounded(Number.isSafeInteger(parsed.dropped) ? parsed.dropped : 0);
        this.state.dropped = bounded(this.state.dropped + parsed.events.length - this.state.events.length);
        for (const [key, value] of Object.entries(parsed.traces).slice(-512)) {
          const trace = value as Trace;
          if (!trace || !validUuid(trace.id) || !Number.isSafeInteger(trace.observed) || trace.observed < 0 || !validRelease(trace.app_version) || !["ios", "android", "web"].includes(trace.platform) || !Number.isSafeInteger(trace.attempts) || trace.attempts < 0 || typeof trace.run !== "string") continue;
          if (trace.first !== undefined && (!Number.isSafeInteger(trace.first) || trace.first < 0)) continue;
          const probe = { event_id: trace.id, trace_id: trace.id, event_type: "operation_queued", occurred_at_ms: trace.observed, operation_type: trace.type };
          if (validEvent(probe)) this.state.traces[key] = { id: trace.id, type: trace.type, first: trace.first, observed: trace.observed, run: trace.run, platform: trace.platform, app_version: trace.app_version, attempts: bounded(trace.attempts), terminal: trace.terminal === true, retiredAt: Number.isSafeInteger(trace.retiredAt) && Number(trace.retiredAt) >= 0 ? trace.retiredAt : undefined };
        }
      }
    } catch { this.state = empty(); this.state.dropped = 1; }
    if (!this.deps.current()) return;
    this.ready = true;
    this.state.dropped = bounded(this.state.dropped + this.waitingDropped);
    this.waitingDropped = 0;
    this.prune();
    const waiting = this.waiting; this.waiting = []; this.waitingBytes = 0;
    for (const signal of waiting) this.capture(signal);
    this.persist();
  }
  credentialsChanged() { if (this.blocked === "auth") this.blocked = null; this.failures = 0; this.nextSendAt = 0; }
  isEnabled() { return this.enabled && this.deps.current(); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) { this.pendingSnapshot = null; this.waiting = []; this.waitingBytes = 0; } if (enabled) { if (this.blocked === "flag") this.blocked = null; this.tick(); } }
  setForeground(foreground: boolean) { this.foreground = foreground; if (foreground) this.tick(); }
  capture(input: DiagnosticSignal) {
    if (!this.enabled || !this.deps.current()) return;
    const signal = projectDiagnosticSignal(input);
    if (!this.ready) {
      const bytes = jsonBytes(signal);
      if (this.waiting.length < 200 && this.waitingBytes + bytes <= MAX_BYTES) {
        this.waiting.push(signal); this.waitingBytes += bytes;
      } else this.waitingDropped = bounded(this.waitingDropped + 1);
      return;
    }
    const now = this.deps.now();
    if (signal.kind === "player") { this.player = signal.active; return; }
    if (signal.kind === "queue") {
      const newIds = new Set(signal.newIds);
      for (const operation of signal.operations) this.trace(operation, newIds.has(operation.id) ? signal.at : undefined);
      this.pendingSnapshot = { depth: bounded(signal.operations.length), unknown: bounded(signal.operations.filter(({ id }) => {
        const first = this.state.traces[id]?.first;
        return first == null || now < first || now - first > 31_536_000_000;
      }).length) };
      this.snapshot();
    } else if (signal.kind === "local") {
      this.add({ event_type: "local_save", outcome: signal.outcome, saved_count: signal.count, duration_ms: signal.duration, error_category: signal.category });
    } else if (signal.kind === "finish") {
      this.add({ event_type: "finish_result", finish_stage: signal.stage, outcome: signal.outcome, duration_ms: signal.duration, error_category: signal.category });
    } else {
      const trace = this.trace(signal.operation);
      if (trace.terminal) return;
      const operation = { trace_id: trace.id, operation_type: trace.type };
      if (signal.kind === "request") {
        if (signal.phase === "start") trace.attempts = bounded(trace.attempts + 1);
        this.add({ ...operation, event_type: signal.phase === "start" ? "sync_attempt" : "sync_result", request_attempt: trace.attempts,
          ...(signal.phase === "start" ? {} : { outcome: signal.phase === "success" ? "success" as const : "failure" as const, duration_ms: signal.duration, error_category: signal.category, http_status: signal.status }) });
      } else if (signal.kind === "retry") {
        this.add({ ...operation, event_type: "retry_scheduled", retry_delay_ms: bounded(signal.delay, 86_400_000), error_category: signal.category });
      } else {
        trace.terminal = true; trace.retiredAt = now;
        const age = trace.first == null ? undefined : now - trace.first;
        const clockInvalid = age !== undefined && (!Number.isSafeInteger(age) || age < 0 || age > 31_536_000_000);
        this.add({ ...operation, event_type: "operation_terminal", outcome: signal.outcome, acknowledgment_kind: signal.acknowledgment,
          ...(signal.outcome === "acknowledged" ? { recovered_after_restart: trace.run !== this.run,
            ...(age !== undefined && !clockInvalid ? { queue_age_ms: age } : {}), ...(clockInvalid ? { clock_invalid: true } : {}) } : {}) });
      }
    }
    this.prune();
    this.persist();
  }
  private trace(operation: DiagnosticOperation, first?: number): Trace {
    let trace = Object.prototype.hasOwnProperty.call(this.state.traces, operation.id) ? this.state.traces[operation.id] : undefined;
    if (!trace) {
      trace = { id: this.deps.uuid(), type: operation.type, first, observed: this.deps.now(), run: this.run, platform: this.deps.platform, app_version: validRelease(this.deps.appVersion) ? this.deps.appVersion : "unknown", attempts: 0 };
      this.state.traces[operation.id] = trace;
      if (Object.keys(this.state.traces).length > 512) delete this.state.traces[Object.keys(this.state.traces)[0]];
      this.dirty = true;
      if (first !== undefined) this.add({ event_type: "operation_queued", trace_id: trace.id, operation_type: trace.type });
    }
    return trace;
  }
  private add(fields: Omit<DiagnosticEvent, "event_id" | "occurred_at_ms">) {
    if (!this.enabled || !this.deps.current()) return;
    const event = Object.fromEntries(Object.entries({ ...fields, event_id: this.deps.uuid(), occurred_at_ms: this.deps.now() }).filter(([, value]) => value !== undefined));
    if (!validEvent(event)) return;
    this.state.events.push({ platform: this.deps.platform, app_version: validRelease(this.deps.appVersion) ? this.deps.appVersion : "unknown", captured_at: this.deps.now(), event });
    if (this.state.events.length > MAX_EVENTS) { this.state.events.shift(); this.state.dropped = bounded(this.state.dropped + 1); }
    this.dirty = true;
  }
  private snapshot() {
    if (!this.pendingSnapshot || this.deps.now() - this.lastSnapshot < 15_000) return;
    const pending = this.pendingSnapshot; this.pendingSnapshot = null;
    this.lastSnapshot = this.deps.now();
    this.add({ event_type: "queue_snapshot", queue_depth: pending.depth, unknown_age_count: pending.unknown, player_active: this.player });
  }

  private prune() {
    const now = this.deps.now();
    const priorEvents = this.state.events.length;
    const priorTraces = Object.keys(this.state.traces).length;
    const priorDrops = this.state.dropped;
    const keep = this.state.events.filter((item) => now - item.captured_at <= TTL && now >= item.captured_at);
    this.state.dropped = bounded(this.state.dropped + this.state.events.length - keep.length);
    this.state.events = keep;
    const traceEntries = Object.entries(this.state.traces);
    const retained = traceEntries.filter(([, trace]) => !trace.terminal || (now >= (trace.retiredAt ?? trace.observed) && now - (trace.retiredAt ?? trace.observed) <= TTL)).slice(-512);
    this.state.traces = Object.fromEntries(retained);
    while (this.state.events.length > MAX_EVENTS || (jsonBytes(this.state) > MAX_BYTES && this.state.events.length)) {
      this.state.events.shift(); this.state.dropped = bounded(this.state.dropped + 1);
    }
    while (jsonBytes(this.state) > MAX_BYTES && Object.keys(this.state.traces).length) delete this.state.traces[Object.keys(this.state.traces)[0]];
    if (priorEvents !== this.state.events.length || priorTraces !== Object.keys(this.state.traces).length || priorDrops !== this.state.dropped) this.dirty = true;
  }
  private persist() {
    if (!this.ready || !this.deps.current() || this.writing || !this.dirty || this.deps.now() < this.writeRetryAt) return;
    this.writing = true; this.dirty = false;
    const serialized = JSON.stringify(this.state);
    const prior = storageFlights.get(this.deps.storageKey) ?? Promise.resolve();
    const flight = prior.catch(() => {}).then(() => this.deps.current() ? this.deps.storage.setItem(this.deps.storageKey, serialized) : undefined);
    storageFlights.set(this.deps.storageKey, flight);
    void flight.then(() => { this.writeRetryAt = 0; }, () => {
      this.dirty = true; this.writeRetryAt = this.deps.now() + 30_000;
    }).finally(() => { if (storageFlights.get(this.deps.storageKey) === flight) storageFlights.delete(this.deps.storageKey); this.writing = false; if (this.dirty) this.persist(); });
  }
  tick() {
    if (!this.deps.current() || !this.ready) return;
    if (this.enabled && this.foreground) this.snapshot();
    this.prune(); this.persist();
    if (!this.enabled || !this.foreground || this.blocked || this.sending || this.deps.now() < this.nextSendAt) return;
    if (this.state.dropped > 0) {
      const count = this.state.dropped; this.state.dropped = 0;
      this.add({ event_type: "diagnostics_dropped", dropped_count: count }); this.prune(); this.persist();
    }
    const first = this.state.events[0];
    if (!first) return;
    const batch: DiagnosticBatch = { schema_version: 1, platform: first.platform, app_version: first.app_version, events: [] };
    for (const item of this.state.events) {
      if (item.platform !== batch.platform || item.app_version !== batch.app_version || batch.events.length === 20) break;
      const next = { ...batch, events: [...batch.events, item.event] };
      if (jsonBytes(next) > MAX_BATCH_BYTES) break;
      batch.events.push(item.event);
    }
    if (!batch.events.length) return;
    const ids = new Set(batch.events.map(({ event_id }) => event_id));
    this.sending = true;
    const cancelled = Symbol("diagnostic-dispatch-cancelled");
    void Promise.resolve().then<DiagnosticReceipt | typeof cancelled>(() => {
      if (!this.deps.current() || !this.enabled || !this.foreground || this.blocked) return cancelled;
      return this.deps.send(batch);
    }).then((receipt) => {
      if (receipt === cancelled || !this.deps.current()) return;
      const total = receipt.accepted + receipt.duplicates + receipt.discarded;
      if (typeof receipt.enabled !== "boolean" || ![receipt.accepted, receipt.duplicates, receipt.discarded].every((value) => Number.isSafeInteger(value) && value >= 0) || total !== batch.events.length) throw new Error("Invalid diagnostic receipt");
      this.state.events = this.state.events.filter(({ event }) => !ids.has(event.event_id));
      this.failures = 0; this.nextSendAt = this.deps.now() + 2_000;
      if (!receipt.enabled) { this.enabled = false; this.blocked = "flag"; }
      this.dirty = true; this.persist();
    }).catch((error: unknown) => {
      if (!this.deps.current()) return;
      const status = (error as { status?: number } | null)?.status;
      if (status === 401 || status === 403) this.blocked = "auth";
      this.failures += 1;
      this.nextSendAt = this.deps.now() + Math.min(60_000, 5_000 * 2 ** Math.min(this.failures - 1, 4));
    }).finally(() => { this.sending = false; });
  }
}

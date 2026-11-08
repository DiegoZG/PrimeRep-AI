export type DiagnosticOperationType = "create" | "set" | "update_set" | "delete_set" | "restore_set" | "update_workout_note" | "update_exercise_feedback" | "update_exercise_note" | "order" | "replace" | "complete" | "abandon";
export type DiagnosticError = "network" | "timeout" | "auth" | "rate_limited" | "server" | "validation" | "admission_conflict" | "storage" | "unknown";
export type DiagnosticOperation = { id: string; type: DiagnosticOperationType };
export type DiagnosticSignal =
  | { kind: "queue"; operations: DiagnosticOperation[]; newIds: string[]; at: number }
  | { kind: "request"; operation: DiagnosticOperation; phase: "start" | "success" | "failure"; duration?: number; category?: DiagnosticError; status?: number }
  | { kind: "terminal"; operation: DiagnosticOperation; outcome: "acknowledged" | "superseded" | "cancelled"; acknowledgment?: "direct" | "reconciled" }
  | { kind: "retry"; operation: DiagnosticOperation; delay: number; category?: DiagnosticError }
  | { kind: "local"; outcome: "success" | "failure"; count?: number; duration?: number; category?: DiagnosticError }
  | { kind: "finish"; stage: "server" | "local_cleanup"; outcome: "success" | "failure"; duration?: number; category?: DiagnosticError }
  | { kind: "player"; active: boolean };

export function projectDiagnosticSignal(signal: DiagnosticSignal): DiagnosticSignal {
  const operation = (value: DiagnosticOperation) => ({ id: value.id, type: value.type });
  switch (signal.kind) {
    case "queue": return { kind: "queue", operations: signal.operations.map(operation), newIds: [...signal.newIds], at: signal.at };
    case "request": return { kind: "request", operation: operation(signal.operation), phase: signal.phase, duration: signal.duration, category: signal.category, status: signal.status };
    case "terminal": return { kind: "terminal", operation: operation(signal.operation), outcome: signal.outcome, acknowledgment: signal.acknowledgment };
    case "retry": return { kind: "retry", operation: operation(signal.operation), delay: signal.delay, category: signal.category };
    case "local": return { kind: "local", outcome: signal.outcome, count: signal.count, duration: signal.duration, category: signal.category };
    case "finish": return { kind: "finish", stage: signal.stage, outcome: signal.outcome, duration: signal.duration, category: signal.category };
    case "player": return { kind: "player", active: signal.active };
  }
}

type Listener = { owner: string; current: () => boolean; emit: (signal: DiagnosticSignal) => void };
let listener: Listener | null = null;
export function setWorkoutDiagnosticListener(next: Listener) {
  listener = next;
  return () => { if (listener === next) listener = null; };
}
export function diagnosticNow() { return typeof performance === "undefined" ? undefined : performance.now(); }
export function diagnosticElapsed(start: number | undefined) {
  const now = diagnosticNow();
  return start == null || now == null || !Number.isFinite(now - start) || now < start || now - start > 86_400_000 ? undefined : Math.round(now - start);
}
export function diagnosticError(error: unknown): { category: DiagnosticError; status?: number } {
  const candidate = error as { status?: unknown; isTimeout?: unknown; name?: unknown } | null;
  const status = typeof candidate?.status === "number" && Number.isInteger(candidate.status) && candidate.status >= 100 && candidate.status <= 599 ? candidate.status : undefined;
  const category = candidate?.isTimeout === true || candidate?.name === "AbortError" ? "timeout"
    : status === 401 || status === 403 ? "auth" : status === 429 ? "rate_limited" : status === 408 ? "timeout"
    : status != null && status >= 500 ? "server" : status === 409 ? "admission_conflict"
    : status != null && status >= 400 ? "validation" : candidate?.name === "TypeError" || (candidate?.name === "HttpError" && status === undefined) ? "network" : "unknown";
  return { category, status };
}
export function workoutDiagnostics(owner: string) {
  const captured = listener;
  const active = () => { try { return captured?.owner === owner && captured.current(); } catch { return false; } };
  const emit = (signal: DiagnosticSignal) => {
    try { if (active()) captured!.emit(projectDiagnosticSignal(signal)); } catch { /* Diagnostic observers cannot affect workout work. */ }
  };
  const acknowledgments = new Map<string, "direct" | "reconciled">();
  const failures = new Map<string, DiagnosticError>();
  return {
    emit,
    acknowledgments,
    failures,
    queue(operations: DiagnosticOperation[], previous?: DiagnosticOperation[], at = Date.now()) {
      if (!active()) return;
      const prior = previous && new Set(previous.map((operation) => operation.id));
      emit({ kind: "queue", operations: operations.map(({ id, type }) => ({ id, type })), newIds: prior ? operations.filter(({ id }) => !prior.has(id)).map(({ id }) => id) : [], at });
    },
    terminal(operation: DiagnosticOperation, outcome: "acknowledged" | "superseded" | "cancelled", acknowledgment?: "direct" | "reconciled") {
      emit({ kind: "terminal", operation: { id: operation.id, type: operation.type }, outcome, acknowledgment });
    },
    request<T>(operation: DiagnosticOperation, call: () => Promise<T>): Promise<T> {
      if (!active()) return call();
      const projected = { id: operation.id, type: operation.type };
      const start = diagnosticNow();
      emit({ kind: "request", operation: projected, phase: "start" });
      return call().then((result) => {
        acknowledgments.set(operation.id, "direct");
        emit({ kind: "request", operation: projected, phase: "success", duration: diagnosticElapsed(start) });
        if (operation.type === "complete") emit({ kind: "finish", stage: "server", outcome: "success", duration: diagnosticElapsed(start) });
        return result;
      }, (error: unknown) => {
        failures.set(operation.id, diagnosticError(error).category);
        emit({ kind: "request", operation: projected, phase: "failure", duration: diagnosticElapsed(start), ...diagnosticError(error) });
        if (operation.type === "complete") emit({ kind: "finish", stage: "server", outcome: "failure", duration: diagnosticElapsed(start), ...diagnosticError(error) });
        throw error;
      });
    },
  };
}

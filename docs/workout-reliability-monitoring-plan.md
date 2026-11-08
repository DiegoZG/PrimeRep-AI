# Workout reliability monitoring

Status: Phases 1–3 implemented and independently verified. Collection remains default off. Phase 4 native/preview verification is pending.

Client implementation details and measurement limitations: [workout-diagnostics.md](workout-diagnostics.md). The diagnostic-only sidecar replaces optional business-store metadata columns to keep diagnostic failures outside workout database initialization and persistence.

Prepared from frontend `main` at `3db343f` and backend `main` at `805ff5c`, after onboarding subscription PRs #112 and #31 merged.

## Outcome

Give PrimeRep operators evidence about local saves, pending writes, retries, recovery and server acknowledgment. Set logging remains instant after its existing durable device write. Diagnostics never add spinners, user retry buttons, workout mutations or a dependency on successful telemetry delivery.

Equipment scanning remains a separate feature and branch. This work does not change subscription access or enable any subscription flag.

## Phase 0 — Verified foundations

Documentation discovery is complete. Read these sources before implementing their respective phases; paths below are relative to the named repository.

| Repository / source | Existing behavior or pattern to reuse |
| --- | --- |
| Frontend `app/workout/active.tsx:1144–1210` | `saveEntries(keys, individual, replay)` waits for `saveWorkoutSetEntries` before confirmed UI, rest and haptics; preserves drafts on device-write failure. |
| Frontend `utils/workoutSetEntries.ts:53–122` | `prepareSetEntries` validates drafts and creates immutable pending `set` / `update_set` operations with stable operation IDs. |
| Frontend `utils/activeWorkoutStore.native.ts:25–127,269–275,353–357,557–570` | Existing operation types, owned durable storage and transaction boundary. SQL `created_at` is rewritten on snapshot saves and is not exposed on loaded operations. |
| Frontend `utils/activeWorkoutStore.native.ts:654–980` | Serialized replay, actual network calls, durable acknowledgment merges and retry policy. Canonical GET/409 reconciliation can acknowledge an operation without another write. |
| Frontend `utils/activeWorkoutStore.web.ts:27–104,253–269,351–574` | AsyncStorage counterpart; preserve equivalent ownership, metadata and replay semantics. |
| Frontend `utils/workoutArrangement.ts:65,136` | Existing acknowledgment/concurrent-save merge helpers that must retain immutable monitoring metadata. |
| Frontend `app/workout/active.tsx:900,984–1004,1050–1057,1462,1593` | Replay and retry opportunities are player-scoped and foreground-driven. `utils/activeWorkoutContext.tsx:42–79` refreshes summaries without draining writes. |
| Frontend `services/httpClient.ts:10–41,53–115` | `requestJson<T>(path, {method, token, body, timeoutMs})`; classify `HttpError.status`, `.code`, `.isTimeout` without retaining `.message` or `.payload`. |
| Frontend `services/accountScope.ts:1–14`; `utils/authContext.tsx:406–424` | Existing generation fences and invalidation before credential cleanup. |
| Frontend `docs/workout-arrangement.md:59–80,118–128` | Persistence/replay requirements and mounted/native test commands. |
| Backend `docs/part9-production-readiness-plan.md:24–30,49–70` | Local-first reliability is delivered; privacy-safe monitoring, ownership, retention and operational verification remain planned. |
| Backend `app/main.py:48–69` | Safe request middleware: route template, request ID, method, release, status and duration; no query/body logging. |
| Backend `app/core/workout_logging_service.py:277–392`; `app/models/workout_session_operation.py:9–24` | Owner-scoped idempotent writes and mutation ledger. Retries are not additional completed sets. |
| Backend `app/api/v1/feature_flags.py:22–33` | Sanitized validation error responses that do not echo rejected request input. |
| Backend `app/core/rate_limit.py:13–26`; `app/core/settings.py:60–74` | Existing authenticated per-user limiter and production shared-storage requirements. |
| Backend `app/core/feature_flag_service.py:15–18,42–63,81–134` | Current subscription-specific allowlists, targeting and audit patterns; a new monitoring flag must be independent of subscription prerequisites. |
| Backend `app/core/export_service.py:211`; `app/core/user_service.py:19` | Explicit export field projection and existing account-deletion entry point. |

No existing diagnostics client, ingestion endpoint, metrics model or configured third-party sink was found. Existing `logging.extra` does not establish that production collectors preserve searchable structured fields.

### Measurement rules

- Preserve a new immutable initial enqueue timestamp. Do not use current SQL `created_at` as the original queue age; do not assign fabricated age zero to old operations.
- Existing `operation.attempts` can increase when a request is deferred without HTTP. Count actual requests at service-call boundaries separately.
- Acknowledgment can be `direct` or `reconciled`. Count a logical operation once after durable acknowledgment merge, including lost-response recovery.
- Incomplete drafts and validation failures are not locally saved sets. An admission/conflict error is not automatically a disk/storage failure.
- Report queue age including suspension/offline time separately from observed request duration and foreground replay opportunities. Do not introduce or promise OS background execution.
- A pending operation, an abandoned report, an intentionally superseded operation and a verified failure are different outcomes. Missing telemetry is not evidence of lost workout data.

## Proposed first-slice contract

### Rollout

Add `workout_reliability_monitoring_enabled`, default off, using the existing audited global/selected-user/override infrastructure. Extend all enumerated constraints and API types deliberately; do not redesign the entire flag service. Its effective value must not depend on purchase, enforcement or onboarding subscription flags. Older API responses without it behave as false.

The flag controls diagnostics capture and ingestion, not the workout queue or its replay. Rollback stops new capture/delivery; it cannot delete, delay or change workout data. Unsent diagnostics expire independently.

### Events and permitted fields

Use a versioned, strictly typed allowlist, rather than arbitrary analytics properties:

- Local save result and elapsed duration, separating success, storage I/O, validation, session-admission/conflict and unknown failure.
- Operation queued, actual HTTP attempt/result, retry scheduled, durable acknowledgment, reconciliation/restart recovery, and explicit supersession/cancellation if the existing queue performs it.
- Queue observations: operation count, age buckets, unknown-age count and foreground/player-active state.
- Finish confirmation or recovery category, keeping server completion separate from local terminal cleanup.

Allowed dimensions: fixed operation/error/outcome categories, bounded numeric durations/counts, acknowledgment kind, schema version, platform, release and environment. A random diagnostic trace ID and event ID may be used privately for deduplication/correlation; they are never metric labels. Do not change or reuse business mutation IDs for telemetry delivery.

Never capture weights, reps, exercise IDs/names, workout dates, notes, feedback, photos, email, tokens, arbitrary URLs, raw exceptions or request/response bodies. Derive account ownership from authentication and deployment environment from backend configuration; neither is a trusted client selector.

### Default delivery and storage

- A separate, bounded, best-effort diagnostic outbox, scoped by account and environment. At most 200 events / 128 KiB per owner, seven-day TTL, documented oldest-event overflow and a bounded dropped-count signal. Do not recursively emit diagnostics about diagnostic failures.
- Fire-and-forget capture after existing business persistence boundaries. No telemetry storage or HTTP promise is awaited by logging, replay, navigation, rest or finish.
- One diagnostic request in flight, at most 20 events / 32 KiB per batch, using `requestJson` with a short `timeoutMs`. Flush in the foreground with capped backoff; no new native background task or external SDK.
- Proposed new authenticated `POST /v1/diagnostics/workout-sync`, separate from workout transactions, with strict validation, sanitized rejection, a per-user rate limit and idempotent event ingestion. This endpoint does not exist yet and must never require a paid subscription.
- Proposed PostgreSQL raw diagnostic storage with a 14-day TTL, deduplicated events and private owner association for isolation/deletion. Retain only allowlisted fields. Export owned records through the existing explicit-field export path; account deletion removes them. Retain identity-free aggregate buckets for up to 90 days.
- First operator readout: a read-only report command and runbook, not a new consumer screen or third-party dashboard account. Storage limits and pruning must be implemented, scheduled and demonstrated, not left as documentation-only promises.

These are implementation defaults for review, not enabled production settings.

## Phase 1 — Define contracts and rollout controls

Implement the shared schema, fixed categories, diagnostic ownership, retention bounds and independent flag. Specify how event IDs survive retry and how a logical trace reaches one terminal outcome. Define event-to-metric mappings before adding capture calls.

Copy the existing flag targeting/audit patterns and sanitized validation pattern cited in Phase 0. Keep changes additive and backward compatible.

Verification:

- Missing/disabled/targeted/overridden monitoring flags and rollback; free accounts remain eligible for diagnostics.
- Reject forbidden/extra fields, oversized strings/batches and unknown schema versions without echoing submitted sensitive values.
- Document event order, duplicates, unknown legacy age, clock changes and supersession semantics with examples.

Guard: do not add a vendor SDK, change workout APIs or make diagnostic delivery a subscription requirement.

## Phase 2 — Backend ingestion, retention and readout

Add the proposed endpoint, migration/model, explicit projections, event deduplication and bounded storage. Use `Depends(get_current_user)`, the existing limiter and safe route-level logging patterns. Preserve existing workout routes and transaction behavior.

Provide a report command showing observed local-write duration, queue-to-ack age distributions, real request failure/retry categories, recovery, pending/unknown-age counts, completion confirmation and diagnostic drops. Use fixed low-cardinality dimensions. Make both diagnostics retention and aggregation pruning runnable through the existing deployment's documented scheduled-job mechanism; if none exists, include an explicit deployment job requirement.

Metrics are client-observed diagnostics, not an independently proven data-loss percentage. Show collection coverage, reporting gaps and pending outcomes alongside successes. Do not derive a 99.9% reliability claim from acknowledgments alone. Suppress low-volume paging; begin with an internal summary and define alert ownership/thresholds from a measured baseline.

Verification:

- Authentication, server-derived ownership/environment, free/expired-subscription access, rate/body limits, duplicate batches and partial failure.
- Retried diagnostic delivery cannot double-count a logical outcome; forged cross-account ownership is ignored/rejected.
- Real migration forward/compatibility checks, retention pruning, export and deletion coverage, synthetic report totals.
- Confirm logs/collector output contains only the allowlist and does not serialize rejected input or workout values.

Guard: never hold a workout transaction open to write a metric, and never interpret diagnostic acknowledgment as workout acknowledgment.

## Phase 3 — Accurate client measurement and isolated capture

Add optional versioned monitoring metadata to new pending operations captured under the enabled flag: a diagnostic trace ID and immutable `firstQueuedAtMs`. Preserve it through native/web persistence, retries, edits, concurrent merges and restart. Keep it separate from immutable business payloads and server fingerprints. If SQLite needs additive nullable columns, implement a real migration; old rows retain unknown original age.

Measure local-write duration around the existing durable storage call. Persisted queue age starts at initial enqueue and includes that first write; label it queue-to-ack age, not an exact server-only or commit-only duration. Use monotonic elapsed time for live spans. Flag implausible/negative wall-clock ages as unknown rather than fabricating a valid latency.

Instrument actual replay service calls without changing their ordering, retry counts, scheduling, session guards, canonical reconciliation or completion logic. Emit one acknowledged outcome only after its durable merge. Preserve traces across retry, and close genuinely superseded work without calling it data loss. Distinguish terminal local cleanup from successful server completion.

Implement the separate diagnostic outbox/delivery service with the existing account-generation fences. Capture owner/environment at creation; never send one owner's events with another owner's token. Expired credentials suspend diagnostic sending until the normal authentication flow supplies a valid owned session; diagnostic failures must not log out the user, open paywalls or refresh tokens in a loop.

Verification:

- Native/web metadata survives repeated snapshot writes, concurrent saves, retry, restart and canonical reconciliation.
- Real requests versus deferred replay; direct and reconciled acknowledgment; lost response; genuine conflict; create/edit/delete/finish semantics.
- Throwing, slow, full or unavailable diagnostic storage/network leaves all existing logging/navigation/finish behavior unchanged.
- Flag-off baseline, foreground/background/player lifecycle, account/environment switches and A→B→A fences.
- Old storage remains readable, drafts remain unlogged, and existing set IDs/targets/rest deadlines remain intact.

Guard: no added awaits in the user's save path, no mutation-ID rewrites, no queue redesign and no hidden promise of background OS replay.

## Phase 4 — End-to-end verification and preview rollout

Start with synthetic preview accounts only. Script normal save, slow response, 5xx, lost response, reconciliation, offline backlog, cold restart, storage failure, finish recovery and account changes. Demonstrate the resulting report against the known injected failures. Replay the same diagnostic batch to prove deduplication; disable the flag to prove rollback without workout data changes.

Extend existing tests rather than replacing their behavior assertions:

- Frontend: `scripts/test-workout-arrangement-player.mjs:533–575,596–638,792–810,999+`, `scripts/test-offline-finish.mjs:114–190,213–277,431–504`, `scripts/test-workout-arrangement-store.mjs:24–80`, `scripts/test-workout-set-entries.mjs:15–114`, and `scripts/test-workout-set-status.mjs:81,126`.
- Add focused diagnostic client/schema/outbox tests, and run affected feature-flag tests. Typecheck only when types/imports change; lint changed files.
- Backend: `pytest tests/test_release_readiness.py tests/test_resumable_workouts.py tests/test_workout_editing.py tests/test_workout_logging.py tests/test_feature_flags.py`, plus new ingestion/report/retention tests and migration checks.
- Native: verify actual SQLite upgrade/restart, instant check/haptic feedback during stalled telemetry, unchanged row position/navigation, rest and finish recovery. Mocked SQLite tests do not replace this check.

Acceptance:

1. Enabled preview events explain the injected sync outcomes without exposing training content.
2. Duplicate retries do not inflate success/failure counts; pending, superseded and unobserved outcomes remain distinguishable.
3. Disabling or breaking diagnostics has no effect on saved workouts or user-visible logging behavior.
4. Queue-age limitations, actual replay lifecycle, retention job, readout instructions and operator ownership are documented.
5. New frontend/backend PRs start from these main revisions, identify dependencies, and keep the monitoring flag off by default. Deploy additive backend support before enabling a preview frontend cohort.

## Scope boundaries

This slice does not rebuild retry policy, add an OS background sync worker, alter workout completion rules, implement scanning, add session replay, choose a paid monitoring vendor, or promise 99.9% reliability. Any actual saving defect uncovered during instrumentation should receive a focused fix with its own regression evidence.

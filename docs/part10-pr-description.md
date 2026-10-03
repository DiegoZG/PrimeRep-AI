# Part 10 — Apple Health iOS integration (frontend)

## What changed

- Added a native iOS HealthKit adapter and a development-only diagnostic for availability, authorization, daily step/sleep reads, and a duration-only test workout write. The diagnostic is separate from the production connection flow and never uploads its sample values.
- Added Health connections under Settings with independent choices to read daily steps and sleep, save newly completed PrimeRep workouts, and use summaries in Coach. The screen explains OS-permission uncertainty, missing data, disconnect behavior, and the privacy gate.
- Added foreground/manual 30-day daily-summary sync with nullable values and connection-revision fencing. Health context remains rules-based, opt-in, and does not change a workout plan or send health values to external AI.
- Added guarded workout export after canonical server completion, including offline-finish reconciliation, a durable account-scoped ledger, stable HealthKit identifiers/versions, and activity mapping from the saved workout snapshot. Local export intent binds to confirmed server consent; failed opt-in cannot reuse a prepared cutoff. Export failures and pending server revocation have retry actions, while conflicting cross-device consent holds exports for review.
- Kept separate read and workout-export withdrawal available for an existing connection even when collection is disabled or HealthKit is unavailable; new enable and data access remain blocked.
- Added account-switch fencing, account-deletion cleanup, Settings alignment, and focused regression coverage. No notes, sets, fabricated calories, or raw health values are exported or logged.
- Added the approved revised Privacy Policy to the app, with `diego.zegarra78@gmail.com` as the changeable contact address. Existing users must review and explicitly accept version `2026-10-02` in Health settings before new read/export actions; automatic sync stays paused until acceptance.

## Verification

- On a physical iPhone, the signed development build reported HealthKit available, returned step aggregates, and wrote one explicit one-minute test workout that was confirmed in Apple Health. No asleep data was recorded in that query; this is **not** proof of denied read access.
- The Health UI, read-sync, and Apple Health adapter suites passed (**23 tests**), including the revised-policy acceptance path. Lint, TypeScript check, UI-action audit, web export, and `git diff --check` passed. The web export used a placeholder HTTPS API URL because the local development URL is HTTP and production export correctly rejects it.
- This physical-device check verifies the basic bridge, **not** the full production connection/export lifecycle.

## Rollout and open gates

Merge and deploy the [backend Part 10 PR](https://github.com/DiegoZG/PrimeRep-AI-Backend/pull/26) before this PR. The backend `HEALTH_COLLECTION_ENABLED` flag remains **false**; new consent, sync, and export must not be enabled in production yet. Existing connections may still withdraw consent.

The revised privacy wording has Diego's approval and is in the app, but is **not yet at a permanent public URL**. Before release: publish it publicly; verify Apple Health capability/disclosures and platform declarations; schedule the backend's 90-day retention purge; and complete signed, physical-iPhone end-to-end tests for connection, real workout export, offline completion, retry, revocation, disconnect, restart, and duplicate prevention. Android Health Connect implementation/testing is deferred by the iOS-first decision. Expo Go cannot exercise the native bridge. Part 9 production infrastructure/restore gates also remain separate.

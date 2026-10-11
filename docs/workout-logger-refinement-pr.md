# Refine workout logging and save entered sets

## Summary

Make active workout logging calmer and more forgiving without changing the backend contract, workout prescriptions, completion synchronization, or Apple Health export eligibility.

## Changes

- Neutral, aligned set rows, readable saved values, small green completion checks, and explicit Suggested / Unsaved / pending-sync labels.
- Logged-row overflow actions for Edit and Remove, with Undo and visible sync retries.
- Compact note/feedback actions, equipment-aware weight labels, a quiet LB/KG control, and a rest timer that leaves the set inputs usable.
- Exercise-level **Save entered sets (N)** saves only user-edited rows, including corrections to logged sets. It never starts or resets rest or advances exercises.
- Persist an optional edited marker with existing draft storage. Suggestions, restored history, and unit changes do not set it; legacy drafts remain individually loggable.
- Shared strict validation and atomic batch persistence on native SQLite and web storage. Preserve invalid drafts, fence account changes, prevent duplicate taps, and replay only after durable save.
- Preserve attempted request IDs and payloads after lost responses; queue subsequent corrections separately and resolve canonical identifiers/versions before sending them.
- Persist per-row acknowledged operation IDs so completion cannot requeue a mutation already acknowledged during an overlapping replay.
- Finish confirmation catches edited entries across exercises and offers save-and-finish, review, or finish logged sets only. Completion is queued after durable set persistence.
- Pending-finish rows remain read-only; Continue logging is primary, Retry Finish secondary, and Close returns Home without discarding the queued finish.
- Safe-area/keyboard-aware layout, first-tap actions, drag/outside keyboard dismissal, accessible labels, 44-point controls, and native text sizing. While typing, the save action stays above the keyboard; otherwise it sits below the rows. Modal transitions are motion-free.

## Verification

- 43/43 focused/regression tests pass across entry validation, batch persistence, partial/lost network responses, storage rollback, rest preservation, restart recovery, account isolation, offline finish races, and Health export. Native and web regressions pass for the acknowledged-operation-ID completion race.
- Frontend lint, TypeScript, and UI-action audit pass.
- Production web export passes.
- Prior Maestro simulator checks cover batch save / save-and-finish, individual logging, edit/remove/Undo, note keyboard dismissal, light/dark appearance, and offline finish / cold-start / Continue logging / reconnection. The final Maestro rerun passed: a fresh two-row batch preserved rest, and save-and-finish saved a forgotten third row and reached the canonical summary.
- Small iPhone SE and accessibility-size layout inspection caught and fixed clipped headings; finish confirmation is scrollable.

## Manual checks before merge

- [x] Physical iPhone: save two edited rows, leave suggestions untouched, verify rest stays unchanged, save with the keyboard open, and finish with a forgotten entry. Diego confirmed: "Works as expected."
- [ ] VoiceOver: row input/action labels, logged/unsaved state, overflow/Undo, and finish choices.

## Dependencies and rollout

- Frontend-only; no backend deployment or database migration.
- Uses the existing set/correction APIs and durable offline queue.
- Optional draft fields, per-row acknowledged operation metadata, and queue metadata are persisted in existing JSON payloads; do not downgrade an installation while it has pending new correction operations.
- Test sessions use the usual local database and disposable test account; no separate database or Health Test app build is required.
- Part 10's production-release gates are unchanged. The physical iPhone check passed; VoiceOver verification remains pending.

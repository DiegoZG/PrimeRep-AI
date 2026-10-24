# Exercise changes during a workout

Exercise ordering and replacement belong to one active session. The player,
resume banner, completed summary, and history use `effectiveWorkout`, falling
back to `workoutSnapshot`. The original snapshot remains available as provenance;
the weekly plan and authored program are never changed.

## Controls

The exercise sheet offers drag handles, visible Move up/down buttons, and screen
reader move actions. Before any set is saved, the new first exercise opens.
After logging starts, the current exercise and running rest period retain their
exercise IDs while the next-up sequence follows the new order.

An online order preview shows supported main/accessory target changes. Users
can apply those targets or keep their existing targets. Entered or edited set
values suppress revised targets. Replacement requires a connection and a flush
of pending set writes. A source with any saved or pending set is protected;
unsaved entries require the explicit **Discard entries and replace** confirmation.
Candidate guidance uses the existing full-height exercise information sheet.

## Recovery

Native SQLite and web AsyncStorage persist the effective workout, revision,
current/rest exercise IDs, and ordered operations before a mutation is sent.
An attempted operation retains its ID and payload through timeout retries.
Offline reorders keep targets, sync automatically after reconnect, and preserve
an optional target-review prompt through restart. Keeping or applying targets
clears that prompt. A revision conflict fetches the authoritative workout and
retains the pending order for explicit review. If another device replaced an
exercise, use the latest workout before reordering again.

## Verification and rollout

- `node --test scripts/test-workout-arrangement-ui.mjs scripts/test-workout-arrangement-store.mjs scripts/test-workout-arrangement-player.mjs`
  checks UI callbacks, accessible and drag moves, typed entry protection,
  replacement confirmation, native/web restart and replay, conflicts, immutable
  provenance and server-owned resume. The mounted-player tests exercise real web
  persistence and hook integration through background replay/autosave, including
  replacement set hydration and single-modal handoffs to review and guidance.
- Existing workout set-entry, correction and summary UI suites check logging
  and completed review regressions.
- Run `npm run typecheck`, `npm run lint`, and an Expo web export. Device gesture,
  layout and screen reader checks require native runtime verification; JS mocks
  alone do not prove those behaviors on a physical device.

Deploy backend [PR 27](https://github.com/DiegoZG/PrimeRep-AI-Backend/pull/27)
and migration `a2b3c4d5e6f7` before distributing this client. Arrangement controls
are absent when the session response lacks `arrangementRevision`, allowing the
new client to keep logging against older API deployments.

## Runtime evidence

Verified on October 23, 2026 using fictional accounts, a disposable PostgreSQL
database, and an isolated API. Existing user accounts, services, and simulator
data were preserved.

- **iOS 18.5, iPhone 16 Plus simulator:** visible Move up/down controls and an
  actual handle drag opened the generated-target preview. Both Keep current
  targets and Apply revised targets saved successfully; moving a new exercise
  first opened it with the revised set rows.
- **Replacement:** typed entries required explicit discard confirmation.
  Exercise guidance opened, its Close control was individually accessible,
  and closing guidance returned to confirmation. Replacing the open exercise
  in position two retained that position, all four replacement rows, and
  fourteen total sets, without a stale pending replacement. The original
  server snapshot remained unchanged.
- **Saved sets and rest:** after logging one fictional set, replacement was
  disabled. Reordering the current exercise retained its saved set and running
  rest timer. At the system accessibility-large text setting, the exercise list
  scrolled and its move controls and disabled replacement remained reachable.
- **Actual offline interruption:** stopping only the isolated API allowed an
  order change to save locally with targets unchanged. After terminating and
  reopening the app while still offline, the order, current exercise, saved
  set, and rest timer survived in real SQLite. Restoring the API automatically
  synced the same operation: server and SQLite advanced to revision five,
  the queue emptied, and optional target review remained available.
- **Web:** an in-app browser fixture passed target preview/apply, replacement
  in position two with four replacement rows and fourteen total sets, reload
  and resume, replacement protection after logging, and reordering while the
  current exercise and rest timer remained stable.

Independent focused verification passed **53 tests** across arrangement UI,
mounted player integration, native/web persistence, and existing set-entry
behavior. Type checking, targeted lint, and the 62-route Expo web export also
passed. Backend verification is recorded in PR 27.

Android runtime checks could not run because no Android SDK or emulator was
available. Physical-device, compact-device, and full VoiceOver gesture checks
remain unverified; native accessibility control discovery was checked through
the simulator hierarchy. Revision conflict and timeout retries were exercised
by the executable native/web persistence harnesses, without a live second
device. These checks did not deploy the app or API.

### Passing iOS captures

![A dragged exercise opens first with revised targets](screenshots/workout-arrangement/ios-revised-order.png)

![A replacement keeps the current second position and fourteen total sets](screenshots/workout-arrangement/ios-replacement.png)

![Exercise controls remain reachable with accessibility large text](screenshots/workout-arrangement/ios-large-text.png)

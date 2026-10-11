# Refine completed-workout correction layout and actions

## Summary

Match the accepted workout logger and summary: readable saved sets, neutral
secondary actions, clear save controls and a keyboard-friendly editor. This is
U06 only, from updated `main` after Workout Summary PR #54 (`503dcf4a`).

## Screenshots

Original 375-point iPhone SE simulator captures use the same existing Lower A
fixture: three logged Glute Bridge sets and an empty workout note. No persisted
workout, set, note, account or Health data is changed to produce these images. Screenshots
are original captures, not synthesized or stitched.

### After — light and dark

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/after-light.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/after-light.png" alt="After: light completed-workout correction with neutral actions and a clear Save note control" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/after-dark.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/after-dark.png" alt="After: dark completed-workout correction with readable saved sets and restrained colors" width="320" /></a>

### After — editing a set

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/edit-light.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/edit-light.png" alt="After: light numeric set editor with labeled fields and Save changes and Cancel" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/edit-dark.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/edit-dark.png" alt="After: dark numeric set editor with neutral fields and clear save hierarchy" width="320" /></a>

<details>
<summary>Before — original correction layout</summary>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/before-light.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/before-light.png" alt="Before: light workout correction with purple Edit icons and inline save text" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/before-dark.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/before-dark.png" alt="Before: dark workout correction with original actions and note layout" width="320" /></a>

</details>

<details>
<summary>After — maximum accessibility text</summary>

The title and status scroll instead of consuming a fixed header. The note action
remains reachable with naturally wrapping text; these are separate scroll-position
captures, not stitched images.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/max-light-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/max-light-actions.png" alt="After: light maximum-text correction note with reachable Save note" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/max-dark-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-workout-correction-refinement/docs/pr-screenshots/u06/max-dark-actions.png" alt="After: dark maximum-text correction note with reachable Save note" width="320" /></a>

</details>

## Changes

- Keep saved sets on neutral bordered surfaces, with legible weights/reps and a
  small green double-check. Pending corrections use a neutral cue and an honest
  "Saving correction" accessibility label rather than claiming edited values
  are already saved.
- Make Edit, Add, Restore, Undo and retry controls neutral. Keep Remove
  restrained and destructive; explicit Save controls are purple with
  contrast-safe pressed feedback.
- Give Back and inline actions actual minimum 44-point targets, with numeric
  fields at least 48 points tall to keep their bordered interiors reachable.
  Label weight and reps fields separately; move them and their actions into
  stacked layouts on narrow screens or expanded text sizes.
- On those stacked layouts, let the workout title and status scroll with the
  content while Back stays reachable. Large text does not consume the editor's
  keyboard viewport in a fixed header.
- Reuse existing WorkoutText locally so native text can grow naturally without
  fixed line-height clipping, truncation or font-size caps. Preserve long workout
  and exercise names, notes and feedback.
- Keep a logged-set edit cancellable without changing persisted values. Keep
  existing new-set cancellation and retry behavior.
- Add safe-area keyboard avoidance, interactive drag dismissal on iOS, and
  background/header tap dismissal. Inputs and controls retain their own taps;
  explicit Save handlers dismiss the keyboard without requiring a second tap.

## Unchanged contracts

Existing API controllers remain unchanged: authenticated owner/session request
fencing; all saved snapshot exercises, including those with zero logs; ordered
set numbers; prescribed-slot limits and deleted-slot exclusion; LB/KG display
and storage conversion; nullable Bodyweight; optimistic corrections with
canonical versions and failure rollback; stable operation IDs for add retries;
409 reloads; Remove confirmation, Undo and Restore; retained failed note drafts;
and canonical refresh when returning to Summary.

Existing action handlers and test IDs are retained. New IDs identify local Cancel
controls, field layouts, logged values and keyboard-safe content for testing.
No bulk-save, extra-set-slot or new workout behavior is added here.

No API, backend, database, migration, storage, permission, Health-data, account,
active-workout or shared theme changes. No new dependency, font, analytics
payload, animation or native rebuild.

## Verification

- `node --test scripts/test-workout-correction-ui.mjs
  scripts/test-workout-summary-ui.mjs scripts/test-workout-set-entries.mjs
  scripts/test-workout-set-status.mjs scripts/test-offline-finish.mjs
  scripts/test-health-export.mjs scripts/test-offline-health-export.mjs`:
  **89/89 passed**, including 24 new correction checks in both themes.
- Renderer tests execute mocked Add/Edit/Cancel, LB/KG/bodyweight entry,
  validation, disabled/pending states, stable add retry, conflict reload,
  optimistic rollback, Remove/Undo/Restore, retained note failures and retry,
  ownership/route switches with delayed responses, snapshot/legacy/zero-set
  exercises, feedback and abandoned read-only states. Keyboard props, target
  guards and Save callbacks are verified here; this is not a physical-device
  save test.
- `npm run lint`, `npm run typecheck`, `npm run audit:ui-actions`,
  `npm run test:audit-ui-actions` and `git diff --check`: passed.
- `EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web
  --output-dir /private/tmp/primerep-u06-web-final`: passed, 62 static routes.
  Existing baseline-browser-mapping, NO_COLOR/FORCE_COLOR and
  expo-notifications-on-web warnings remain; no dependency changes were made.

- Independent code-quality and anti-pattern review passed; the reviewer reran
  all 89 focused checks and the shared gates, including the adaptive-header
  placement, pending accessibility state and unchanged controller boundaries.
- Final-source, read-only light/dark Maestro navigation passed **2/2**: existing
  Summary → correction → Back refresh → Done/Home. The safe draft flow also
  passed both themes before the final input-height-only adjustment.
- Final 48-point numeric inputs were inspected natively in both themes: iOS
  accessibility bounds were 46 points inside the border; Cancel was 44 points.
  Edit entry, header/background keyboard dismissal and Cancel passed
  **2/2**, restoring the original saved values without API writes. Actual Save
  while the keyboard is open remains a physical-device/mutating-fixture check;
  renderer callbacks cover it without pretending this read-only test saved data.
- Maximum accessibility text was inspected in both themes. The adaptive title
  scrolls, the note input and Save note remain reachable, and typing a local
  generic note then dismissing its keyboard passed in both themes. Save note
  was not pressed. The maximum-text numeric-editor driver could not complete
  its bounded two-attempt flow; that live interaction remains manual, not a
  proven app defect or a claimed pass.
- Original light/dark screenshots were checked independently for readable
  layout and privacy. Initial transient loading and capture/driver issues were
  recovered without authentication reset or backend changes; unsettled captures
  are excluded. The isolated simulator was restored to normal `large` text,
  light appearance and Home, with the existing Upper A 4/4 active workout
  verified and preserved using Keep Workout Active.

## Manual checks and boundaries

Physical-iPhone, VoiceOver, native drag-to-dismiss and maximum-text
numeric-keyboard checks remain manual. Native save/delete/restore,
network failure, account switching, unusually long titles/notes, zero-set and
abandoned fixtures are not claimed as live simulator tests unless separately
recorded. Existing completed data and the active Upper A workout are preserved;
the legacy mutating `workout-correction.yaml` flow is not run on that fixture.

This styling PR does not close the separate Part 9 infrastructure or Part 10
Health/platform release gates.

## Dependencies, rollout and rollback

- Depends on merged Summary PR #54; review U06 separately before merging.
- Frontend-only visual change; no backend deployment or migration ordering.
- Roll back by reverting this PR. There is no data migration or persistent-state
  rollback, and existing correction APIs remain compatible.

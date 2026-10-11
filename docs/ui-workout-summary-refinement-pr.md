# Refine workout summary hierarchy and accessible layout

## Summary

Match the accepted logger and Health connections direction: readable saved
values, neutral secondary actions and a modest completion cue. Done remains the
main purple action. This is U05 only, from updated `main` after Catalog PR #53
(`d7fa3db0`).

## Screenshots

Original 375-point iPhone SE simulator captures use the same existing Lower A fixture:
4m 22s, three sets, 3,640 lb and no workout note. These are original captures,
not synthesized or stitched, and do not replace physical-iPhone or VoiceOver
checks.

### After — light and dark summary

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-light-top.png" alt="After: light summary with a small green completion cue and neutral metrics" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-dark-top.png" alt="After: dark summary with readable values and neutral metric icons" width="320" /></a>

### After — actions

Separate scroll-position captures show neutral Share and Review, with Done as
the primary purple action.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-light-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-light-actions.png" alt="After: light summary with neutral secondary actions and purple Done" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-dark-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/after-dark-actions.png" alt="After: dark summary actions with readable logged values" width="320" /></a>

<details>
<summary>Before — original summary and actions</summary>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-light-top.png" alt="Before: light summary with purple completion tile and metric icons" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-dark-top.png" alt="Before: dark summary with original purple completion tile and metrics" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-light-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-light-actions.png" alt="Before: light summary actions with purple Share treatment" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-dark-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-workout-summary-refinement/docs/pr-screenshots/u05/before-dark-actions.png" alt="Before: dark summary actions with purple Share treatment" width="320" /></a>

</details>

## Changes

- Replace the large purple completion tile with a small semantic green check.
  Keep the completion heading and saved workout title naturally wrapping.
- Use neutral metric icons and descriptive labels, with saved values in primary
  text. Keep two compact columns at ordinary text sizes; use one column on
  narrow screens, expanded text or unusually long metric values.
- Reuse the existing WorkoutText presentation helper locally so native text
  height can grow without fixed line-height clipping. No truncation or font-size
  caps are added.
- Make Share and Review neutral, full-width secondary controls; retain purple
  Done with a contrast-safe pressed fill. All actions have actual minimum
  44-point targets, wrapping labels and pressed feedback.
- Keep notes and logged values in legible primary text. Empty and loading
  states stay honest; the unavailable Home action is neutral and reachable in
  a scroll container.
- Keep the existing failed-refresh review action, making its touch target
  explicit and semantic error color readable in both themes.

## Unchanged contracts

The focus refresh controller is unchanged: authenticated owner/session fencing,
cancelled-response protection, saved canonical summary, status checks, weight
preference loading and Health reconciliation's completion/policy/cancellation
gates. Corrections still open the same editor; returning refreshes canonical
totals, while a failed refresh retains the saved summary and exposes its existing
review action.

Set grouping and ordering, nullable Bodyweight display, LB/KG conversion,
duration/volume formatting and the exact native Share payload remain unchanged.
Share still excludes notes and uses its existing failure alert and Try Again.
Existing action handlers and test IDs remain; presentation IDs are additive.

No API, backend, migration, storage, permission, Health-data, account, active
workout or shared theme changes. No new dependency, font, analytics payload,
animation or native rebuild.

## Verification

- `node --test scripts/test-workout-summary-ui.mjs
  scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs
  scripts/test-offline-finish.mjs scripts/test-health-export.mjs
  scripts/test-offline-health-export.mjs`: **65/65 passed**, including 14 new
  summary checks. Both themes cover neutral hierarchy/contrast/targets, canonical
  totals, LB/KG, sorted weighted/unweighted logs, notes, exact privacy-light Share
  payload and failure retry, adaptive/natural text, zero sets, loading/error and
  non-completed status, correction-return refresh and truthful failed refresh.
  Delayed account/session/focus responses and Health policy/cancellation gates
  are checked with mocks, without live health access or data mutations.
- `npm run lint`, `npm run typecheck`, `npm run audit:ui-actions` and
  `npm run test:audit-ui-actions` passed.
- Independently, `node --test scripts/test-home-ui.mjs
  scripts/test-home-dashboard.mjs scripts/test-health-ui.mjs
  scripts/test-health-read-sync.mjs scripts/test-apple-health-adapter.mjs
  scripts/test-health-export.mjs scripts/test-health-account-deletion.mjs
  scripts/test-offline-finish.mjs scripts/test-offline-health-export.mjs`:
  **84/84 passed**. This wider regression run overlaps the 65-check run above;
  their counts are not added together.
- `git diff --check` passed.
- `EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web
  --output-dir /private/tmp/primerep-u05-web`: **62 routes exported**. Only the
  existing baseline-browser-mapping, NO_COLOR/FORCE_COLOR and expo-notifications
  web warnings appeared; no TLS bypass was used.

## Native evidence and remaining checks

- Normal light and dark runs of `.maestro/workout-summary-refinement.yaml`
  passed: **2/2**. Both opened the existing completed summary, reached actions,
  opened Review without editing, returned for canonical refresh and used Done
  to return Home.
- Bounded maximum-accessibility-text inspection in both themes verified natural
  wrapping, single-column metrics and scrollable reachable actions. Normal
  screenshots show the two-column layout. Maximum-text captures are after-only;
  there is no before/after maximum-text comparison claim.
- The real native iOS share sheet opened and was closed. Nothing was shared,
  copied or sent externally; the mock suite separately checks payload and
  failure retry.
- The dedicated 375-point iPhone SE used an existing completed session on the
  usual local database. The active Upper A workout and its four logged sets were
  preserved. No corrections, notes, program activation, Health connection/
  permission or data writes were used to obtain screenshots.
- Restored normal text, light appearance and Home; the existing Upper A 4/4
  Resume action was visually confirmed. An additional post-Done assertion used
  the wrong Home selector and failed, then the actual `home-resume-workout`
  screen was verified; this is not presented as an app defect or an extra
  end-to-end pass.

Physical-iPhone and VoiceOver acceptance remains manual. Long titles/notes,
extreme totals, nullable weight, zero-set and failed-refresh/account-race states
are covered in focused rendering tests; they are not represented as live native
fixture captures. Health and production release gates remain separate.

## Dependencies and rollout

Requires merged Catalog PR #53 only as the updated branch baseline. This screen
does not change Catalog or shared components. No backend deployment, migration
or feature flag is needed; rollback is the frontend commit. U06 completed-workout
correction is the next screen, not part of this PR.

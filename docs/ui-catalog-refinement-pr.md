# Refine program catalog controls and accessible layout

## Summary

Make browsing and filtering programs match the accepted Explore direction:
neutral, clearly selected controls; readable native text; and a catalog that
remains reachable when filters or accessibility text expand. This is U04 only,
from updated `main` after the approved U01–U03 merges (`49c9d9d`).

## Screenshots

Original 375-point iPhone SE simulator captures, with native system typography.
Tap each preview for the full-size PNG. These are original captures, not
synthesized or stitched; they do not replace physical-iPhone or VoiceOver checks.

### After — light and dark catalog

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-light.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-light.png" alt="After: light catalog with neutral scope controls and program cards" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-dark.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-dark.png" alt="After: dark catalog with neutral scope controls and program cards" width="320" /></a>

### After — expanded filters

Build muscle is selected in these separate scroll-position captures.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-light-filters.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-light-filters.png" alt="After: light filters with checked neutral selected chips" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-dark-filters.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/after-dark-filters.png" alt="After: dark filters with checked neutral selected chips" width="320" /></a>

<details>
<summary>Before — original unavailable runtime state, not a same-data comparison</summary>

The normal baseline captures showed a transient catalog error. An ordinary app
reload later restored the catalog without an authentication reset, backend fix
or data mutation. These show the original controls/layout only; this styling PR
does not claim to fix that error or compare identical result data.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-light-unavailable.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-light-unavailable.png" alt="Before: light catalog unavailable state with original purple controls" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-dark-unavailable.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-dark-unavailable.png" alt="Before: dark catalog unavailable state with original purple controls" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-light-filters-unavailable.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-light-filters-unavailable.png" alt="Before: light expanded filters while catalog is unavailable" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-dark-filters-unavailable.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6d5ff53566de944d4cc1c53c3d3aa96c1cfa996b/docs/pr-screenshots/u04/before-dark-filters-unavailable.png" alt="Before: dark expanded filters while catalog is unavailable" width="320" /></a>

</details>

## Changes

- Replace the catalog's one-line shared header with a catalog-local header:
  readable count/recommendation text, native wrapping and the existing Back and
  Build actions. At expanded text sizes, put the title below the action row.
  Other ProgramHeader consumers are untouched.
- Put the header, scopes, expanded filters and results in one vertical scroll
  area, removing the fixed 48-point scope row and the non-scrolling filter panel.
- Give scope/filter chips and the Filters toggle real 44-point minimum targets,
  neutral selected surfaces, a contrasting border, a selected check and the
  existing spoken filter names/selection states. Add clear pressed feedback.
- Keep normal filter groups horizontally browsable. At expanded text sizes,
  short goal/experience/schedule groups wrap. Equipment remains a horizontal
  strip with bounded, wrapping labels rather than making its roughly 130
  choices consume dozens of vertical screens.
- Add a neutral, wrapping **Hide filters** action at the panel's bottom. Hiding
  the panel keeps selections and does not reload or reset the catalog.
- Use catalog-local loading/empty/error presentation with legible muted text
  and a neutral Retry. Load more is also neutral, retaining busy/disabled state.
  Build remains purple with a contrast-safe darker pressed fill. Error text
  retains semantic red with a legible local dark-theme tone.
- Reuse the already-refined compact ProgramCard without changing it: active/
  scheduled status, equipment warnings, cadence and match reasons stay intact.

## Unchanged contracts

The catalog request/controller block is unchanged: route scope/recommendation
initialization, clearing recommended on explicit filter changes, toggle behavior,
multi-equipment selection, 20-item pagination/deduplication, authenticated account
and superseded-request fencing, active/scheduled tagging and focus refresh.
Program cards keep their existing detail destinations. Build still resets the
draft before navigating; tests use mocks, and native verification must not enter
the builder or alter the existing draft. Existing test IDs and action handlers
remain, with additive scroll, Retry/Build and Hide filters IDs.

No backend/API, migration, storage, permission, Health, active-workout, shared
theme-token, global typography or shared ProgramHeader/ProgramCard changes. No
new dependencies, idle animation or native rebuild.

## Verification

- `node --test scripts/test-catalog-ui.mjs scripts/test-explore-ui.mjs
  scripts/test-exercise-foundation.mjs`: **46/46 passed**. Catalog contributes
  14 checks in both themes: control sizing/contrast/selection, recommendation
  and filter query semantics, multi-equipment selection, active/scheduled and
  equipment presentation, match reasons, detail/Back/Build routes, draft-reset
  contract, deduplicated/busy pagination, retryable partial failure, loading/
  error/empty actions, expanded scrolling/no text caps, Hide filters without a
  new request, and delayed account/superseded-filter responses.
- The existing Explore catalog-consumer regression is retained; its native
  fixture mock gains only ActivityIndicator support for the local loading UI.
- `node --test scripts/test-home-dashboard.mjs scripts/test-health-ui.mjs
  scripts/test-health-export.mjs scripts/test-offline-finish.mjs
  scripts/test-offline-health-export.mjs`: **64/64 passed**. Together with the
  focused catalog/Explore/foundation suite, **110/110 checks passed**.
- `npm run lint`, `npm run typecheck`, `npm run audit:ui-actions` and
  `npm run test:audit-ui-actions` passed.
- `EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web
  --output-dir /private/tmp/primerep-u04-web`: **62 routes exported**. Only the
  existing stale baseline-browser-mapping, NO_COLOR/FORCE_COLOR and
  expo-notifications web warnings appeared; no TLS bypass was used.
- `git diff --check` passed.

## Native evidence and remaining checks

- Native BEFORE captures on the dedicated 375-point iPhone SE showed the
  purple-heavy selected controls and an expanded filter panel pushing Retry
  below the viewport. Maximum text showed title/subtitle ellipsis and vertically
  cropped scopes inside the fixed-height row.
- Initial native catalog requests were transiently unavailable despite a live
  local backend; the catalog subsequently loaded five plans after an ordinary
  app reload. No authentication reset, backend fix or data mutation was used.
  The cause is unconfirmed; this PR does not claim to fix that transient error.
- The scoped `.maestro/program-catalog-refinement.yaml` flow passed in both
  light and dark at normal text: All → PrimeRep → Mine, goal/experience/frequency
  selection and deselection, bottom Hide filters, program card → program-day
  detail, and return Home. The flow is read-only: no builder entry, program
  activation, favorite mutation, draft reset, active-workout discard, Health
  access or test-account reset.
- Maximum-text simulator inspection confirmed contained header/scope labels,
  readable wrapping equipment names, reachable bottom Hide filters and results
  after closing the panel, and 44-point accessibility bounds. Extreme text can
  wrap short labels mid-word; no global font cap is introduced. The simulator
  was restored to normal text, light appearance and Home; the existing Upper A
  workout remained intact at 4/4 sets.
- Native pagination was not exercised because the fixture has five plans.
  Post-change native error Retry, account switching and active/scheduled
  fixture cards were not forced; rendered tests cover those contracts. Build was
  deliberately not entered to preserve the existing draft; its reset/navigation
  contract is mock-tested.
- Physical iPhone, VoiceOver traversal/selected announcements, hardware keyboard
  and long/localized native labels remain manual acceptance gaps unless an
  explicit result is recorded. Mock-backed rendered tests do not prove native
  layout, touch dispatch or focus behavior. The existing renderer deprecation
  notice remains non-blocking.

## Dependencies, rollout and rollback

U03's shared ProgramCard prerequisite was approved and merged in PR #52 before
this branch. Review/merge this catalog slice separately; no automatic merge is
authorized. The remaining screen slices and Part 10 production/legal gates are
not completed by this UI change. Rollback is a frontend presentation commit
revert, with no data conversion or changes to workout drafts, Health choices or
account state.

# Update Home with calmer cards and adaptive layout

## Summary

Refine Home to match the accepted workout logger and Health settings direction:
neutral supporting content, readable system typography, and purple concentrated
on the main Resume/next-workout action. This is the independent U02 screen slice.

## Screenshots

After-refinement native iPhone SE simulator captures (375-point width, normal
text), using the existing test fixture. The lower-screen image is a separate
scroll position, not a stitched screen. Tap a preview for its full-size image.
These presentation captures do not close the manual checks listed below.

### Light — workout action and cards

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-home-refinement/docs/pr-screenshots/u02/light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-home-refinement/docs/pr-screenshots/u02/light-top.png" alt="Home after refinement in light mode, Resume action and neutral workout carousel" width="320"></a>

### Dark — workout action and cards

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-home-refinement/docs/pr-screenshots/u02/dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-home-refinement/docs/pr-screenshots/u02/dark-top.png" alt="Home after refinement in dark mode, Resume action and neutral workout carousel" width="320"></a>

### Light — Coach guidance and training trend

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-home-refinement/docs/pr-screenshots/u02/light-guidance-trend.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-home-refinement/docs/pr-screenshots/u02/light-guidance-trend.png" alt="Home after refinement in light mode, compact Coach guidance and four-week trend" width="320"></a>

## Changes

- Replace position-based rainbow workout gradients with theme-native neutral
  surfaces. Retain Today and the Coach-confirmed next-workout border; completed
  cards are not promoted to "next."
- Let workout titles, primary-action copy, Coach guidance, and trend labels wrap.
  Replace fixed-height/absolutely positioned card content with natural layout;
  preserve carousel widths and snapping.
- Wrap section headers, stack Quick Stats at accessibility text sizes, and give
  the same four trend weeks a two-column layout when more space is needed.
- Remeasure the presentation subtree when iOS Dynamic Type changes while Home
  stays mounted; retain resource/account/session state, close stale menu anchors,
  and recenter the carousel on its existing confirmed highlight.
- Quiet secondary retry, history, program-browse, overflow, and Coach actions.
  Provide real 44-point action targets and visible pressed treatments. Primary
  action text is opaque white in both themes and pressed states.
- Keep the active workout visually dominant, correct the first-workout spoken
  action to "Open your first workout," and use singular exercise-count copy.
- Add rendered Home tests in both themes and a read-only native layout flow.

## Unchanged contracts

No APIs, migrations, storage, permissions, shared theme tokens, global typography,
or new Home content. Local active-workout/offline priority, Coach targets and read
marking, LB/KG/equipment-aware presentation, timezone-aware weekly counts,
unknown-versus-zero stats, account request fencing, pull-to-refresh, sharing,
overflow-menu options, and workout navigation remain intact. Semantic chart,
success, and error colors are retained.

## Verification

- `node --test scripts/test-home-ui.mjs scripts/test-home-dashboard.mjs`:
  **17/17 passed**. Covers both themes, neutral cards, wrapping and adaptive
  layout, selected/menu contracts, local offline Resume priority, first/complete/
  unavailable states, independent loading/failures/retries, unknown/zero stats,
  pressed treatments, LB/KG presentation delegation, navigation/read-mark failure,
  successful read refresh, all Home refresh sources, and font-scale remounts
  without account/resource refresh or loss of the local active-workout action.
- `node --test scripts/test-profile.mjs scripts/test-offline-finish.mjs
  scripts/test-offline-health-export.mjs scripts/test-health-export.mjs`:
  **51/51 passed**, including delayed-account isolation and offline/Health export
  regressions. These are automated mock-backed regressions, not new physical
  Health read/write tests.
- Frontend lint, TypeScript, UI-action audit, audit self-tests, and
  `git diff --check`: passed.
- Web export with `EXPO_NO_DOTENV=1
  EXPO_PUBLIC_API_URL=https://api.example.com`: passed, **62 routes**. Existing
  baseline-browser-mapping, NO_COLOR/FORCE_COLOR, and web notification-listener
  warnings remain non-blocking; no dependency changes are included.
- Native before/after light/dark captures were taken on an isolated 375-point
  iPhone SE simulator. The existing Upper A active workout and Health choices
  were preserved; no sets were logged and no Health data was read or written.
  `.maestro/home-refinement.yaml` passed in both themes at normal text size:
  independent overflow/dismiss, workout detail/back, stats, history/back, and
  refresh. Maximum accessibility text was visually inspected in both themes,
  including scrolling to cards, stacked stats, Coach, and the four-week trend.
  A live normal-to-maximum text-size change passed without an app restart after
  the local presentation remeasurement fix. Device appearance/text size were
  restored; these layout passes did not connect, sync, or write Health data.
  The final normal-size rerun reached the History action but its test-ID tap
  missed after scrolling, so that last full rerun is **not** recorded as passing.
  A bounded follow-up using the observed action bounds opened History on the
  first tap, returned Home, and confirmed the unchanged Upper A 4/4 Resume state.

## Manual checks and known limitations

- Physical iPhone and VoiceOver traversal/announcement checks are still required
  before calling the full screen acceptance complete.
- Long workout/Coach strings are covered by rendered tests; the local native
  fixture uses short titles and is not presented as a native long-title test.
- Changing Dynamic Type intentionally resets Home's scroll presentation and
  closes an open card menu while native text is remeasured. The carousel returns
  to its existing confirmed highlight; account, guidance, and active-workout
  state do not reset.
- The existing shared WorkoutCardMenu accessibility tree combines its content
  under the backdrop on iOS. The menu remains visible and usable, but this PR
  does not claim to repair its shared VoiceOver behavior or change that component.
- Native automation occasionally misses the History test-ID tap after centered
  scrolling; the observed-bounds follow-up worked. This driver caveat does not
  by itself establish an app defect and is documented in the Maestro README.
- No legal, production infrastructure, or Part 10 release gate is passed by this
  styling PR.

## Dependencies, rollout, and rollback

This branch starts from updated `main` (`37c811f`) and does not include or depend
on the independent calculator PR. No backend deployment is needed. Review and
merge this screen separately; later screens must obtain approval before any
dependent merge. Rollback is a frontend commit revert, with no data conversion,
consent change, or loss of local workout drafts.

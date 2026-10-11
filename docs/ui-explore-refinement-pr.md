# Update Explore with calmer, readable discovery cards

## Summary

Refine Explore to match the accepted workout logger and Health settings direction: neutral surfaces, readable metadata and restrained purple on the main Browse programs action. No search, program, favorite, account, workout or Health behavior is changed.

## Screenshots

After-refinement native iPhone SE simulator captures (375-point width, normal
text), using the existing test fixture. Tap a preview for its full-size image.
These presentation captures do not close the manual checks listed below.

### Light — discovery and program card

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-explore-refinement/docs/pr-screenshots/u03/light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-explore-refinement/docs/pr-screenshots/u03/light-top.png" alt="Explore after refinement in light mode, quiet search and neutral program discovery card" width="320"></a>

### Dark — discovery and program card

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-explore-refinement/docs/pr-screenshots/u03/dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/refs/heads/feat/ui-explore-refinement/docs/pr-screenshots/u03/dark-top.png" alt="Explore after refinement in dark mode, quiet search and neutral program discovery card" width="320"></a>

## Changes

- Replace the decorative Favorites gradient, shadows and press spring with a compact neutral card, restrained heart, readable count and native pressed feedback.
- Make Build controls secondary. The loaded empty Your programs state has one clear Build entry; the header entry remains available during search, loading and errors, and populated sections retain their existing Build routes.
- Keep scoped search visibly selected through its border and accessibility state. Add an explicit native search name and test ID, allow scopes and section headings to wrap, and dismiss the keyboard on dragging search results.
- At expanded text sizes, let the header, search input and discovery/search content share one vertical scroll area; stack section titles and links instead of squeezing them side by side. Normal text keeps the convenient fixed header. The search input stays mounted when a query changes the result view.
- Keep Browse programs as the filled purple action; category icons, section links and pagination controls are neutral. Local loading/error descriptions use legible muted colors without altering shared theme tokens.
- Neutralize ProgramCard's decorative scope, cadence, level and goal colors. Keep filled versus empty training-day marks, Active/Starts next week states, equipment warnings, metadata and match reasons. Announce the visible active/scheduled status in each card's spoken label. Long card text wraps at native text sizes, including the catalog's compact-card consumer.
- Add rendered presentation/action tests and a read-only native Explore flow.

## Verification

- `node --test scripts/test-explore-ui.mjs`: 21 passing checks across both themes, full/compact cards and the actual program catalog consumer. Coverage includes Build routes, single empty-state entry, category/favorites navigation, active/scheduled/equipment review routes, selected search scopes, pagination, no results, failed favorite rollback, disabled program targets, delayed account-response fencing and expanded-text scrolling/input stability.
- Independent Explore + exercise-foundation run: 32/32 passing checks, including the expanded-text scrolling fix.
- Semantic ProgramCard pill text checked against its actual blended tint: Active/Starts next week are 5.14:1/6.03:1 in light mode and 7.53:1/6.93:1 in dark mode. Rendered tests enforce a 4.5:1 minimum.
- Existing focused regressions: 75/75 passing checks across `test-exercise-foundation`, `test-home-dashboard`, `test-health-ui`, `test-health-export`, `test-offline-finish` and `test-offline-health-export`.
- Final combined run after the expanded-text width fix: 96/96 passing checks (21 Explore checks plus the 75 existing regressions).
- `npm run lint`, `npm run typecheck`, `npm run audit:ui-actions`, audit self-tests and `git diff --check` passed.
- Web export passed again after the final layout fix with a valid HTTPS placeholder API (`EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://api.example.invalid`), generating 62 routes; no production endpoint or TLS-check bypass was introduced.

## Native and manual acceptance

- Baseline light/dark Explore and library screenshots captured on the dedicated 375-point iPhone SE simulator before editing.
- Final normal light/dark Explore and the compact catalog were inspected successfully. After correcting the fixed-header and expanded-heading layout issues, the 375-point maximum-text heading/library in both themes were inspected: content stays horizontally bounded and the library remains reachable by scrolling. Extreme text sizes can wrap long words across lines; text is not capped.
- Individual read-only native checks reached recommendations/catalog, empty Favorites, all three search scopes and exercise detail. The authored complete Maestro flow is **not** claimed as an end-to-end pass: driver scroll/tap/keyboard misses required bounded individual checks.
- The native flow is deliberately read-only: it does not enter the builder (which resets a draft), mutate favorites/programs, reset authentication, discard the active workout or request Health access.
- The dedicated simulator was restored to light appearance, normal `large` text and Home. Its existing Upper A workout with 4/4 logged sets remains intact.
- Remaining manual/native acceptance: physical iPhone, VoiceOver traversal, native category routing and active/scheduled fixture cards. The builder was deliberately not entered because it resets a draft. Data-dependent empty/error/equipment-review/account-switch behavior is covered by rendered tests rather than by modifying the native fixture.

## Dependencies and rollout

- Branch starts from updated `main` (`37c811f`), independently of the calculator and Home refinement PRs. No backend deployment, API change, migration, permission, storage or native rebuild is required.
- ProgramCard presentation is shared with the program catalog. Merge this U03 PR with Diego's approval before creating U04's catalog refinement PR, so the latter builds on one accepted shared-card baseline.
- Preserve the existing private program drafts, active workout, Health preferences and test account. Rollback is reverting this presentation-only commit; no data rollback is needed.

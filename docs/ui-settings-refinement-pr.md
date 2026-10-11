# Refine Settings layout and control hierarchy

## Summary

U07 of the app-wide UI refinement: match the calmer workout logger and Health connections while keeping Settings behavior unchanged.

- Native switches use neutral tracks in both states, with a purple ON thumb and grey OFF thumb. Renderer checks verify the requested thumb/track colors have at least 3:1 contrast without changing Health connections or shared theme tokens; native ON and Premium states remain manual checks.
- Appearance and Units retain meaningful selection through high-contrast check/radio icons, neutral selected fills, and their existing accessibility state.
- Preference labels stack on small screens; Appearance choices become vertical at larger text sizes instead of collapsing. The title scrolls at accessibility sizes, and text uses uncapped native line metrics.
- Coach and Premium setting titles align with their switches, with explanations below. Reminder controls wrap without fixed-width clipping.
- Ordinary actions and saved confirmations stay neutral; the explicit reminder Save is the single filled purple action with white text above 4.5:1 contrast. Errors and Delete remain visible in both themes. Back, switches and actions provide 44-point targets and pressed/disabled treatments.

## Unchanged behavior

The existing Settings controller block is byte-equivalent to `main`: notification permission requests, push-device registration cleanup, Coach reminder validation/timezones, delayed-account request fencing, appearance and units persistence, Premium gating, logout, account deletion and Health-export cleanup are unchanged. Existing routes and test IDs are retained.

No backend, migration, API, Health permission, shared theme, package, storage or fixture changes. Screenshots and native checks use the existing local simulator account without changing its preferences, permissions, Health choices, or active workout.

## Screenshots

Original iPhone SE (375-point) screenshots from the existing local account. Tap a preview to open it full-size. These are unedited simulator captures, not mockups or composites; no preferences, notification permissions, Health choices or workout data were changed to create them.

### After · Light

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-top.png" alt="Refined Settings preferences in light mode" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-actions.png" alt="Refined Settings destinations and account actions in light mode" width="320" /></a>

### After · Dark

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-dark-top.png" alt="Refined Settings preferences in dark mode" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-dark-actions.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-dark-actions.png" alt="Refined Settings destinations and account actions in dark mode" width="320" /></a>

<details>
<summary>Before · Light and dark</summary>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/before-light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/before-light-top.png" alt="Original Settings preferences in light mode" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/before-dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/before-dark-top.png" alt="Original Settings preferences in dark mode" width="320" /></a>

</details>

<details>
<summary>Maximum text · Before and after</summary>

Before: Appearance controls collapse and Units extend beyond the card.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/before-light-max-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/before-light-max-top.png" alt="Original Settings at maximum text size" width="320" /></a>

After: scrollable title, stacked Appearance choices and readable, reachable Units. Native text remains uncapped; extremely large text can wrap long words.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-max-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-max-top.png" alt="Refined Settings at maximum text size in light mode" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-dark-max-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-dark-max-top.png" alt="Refined Settings at maximum text size in dark mode" width="320" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-max-units.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/60ab8b20809e5bf9a0fdc270b8ce2bc4f9a44791/docs/pr-screenshots/u07/after-light-max-units.png" alt="Refined Units controls at maximum text size" width="320" /></a>

</details>

## Verification

- `node --test scripts/test-settings-ui.mjs scripts/test-profile.mjs scripts/test-health-ui.mjs scripts/test-health-read-sync.mjs scripts/test-apple-health-adapter.mjs scripts/test-health-export.mjs scripts/test-health-account-deletion.mjs scripts/test-offline-finish.mjs scripts/test-offline-health-export.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs` — 124/124 passed, including 21 new Settings tests.
- `npm run lint`, `npm run typecheck`, `npm run audit:ui-actions`, `npm run test:audit-ui-actions`, and `git diff --check` passed.
- `EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --output-dir /private/tmp/primerep-u07-web` passed: 62 routes. Existing warnings concern baseline-browser-mapping age, NO_COLOR/FORCE_COLOR and the web notifications listener.
- New renderer coverage: light/dark native switch tracks/thumbs/hit targets, disabled state and contrast; visible selection; small/large text; all destinations; notification refusal/grant; reminder validation, pending save/failure and load retry; appearance/unit failure; Premium callback; delayed account loads/saves; delete cancellation and mocked cleanup order.
- `.maestro/settings-refinement.yaml` passed end-to-end in light and dark mode (2/2): visible preferences and Coach switch, Health/Legal/Help/Data destinations, Terms and Help read-only navigation, and return to Settings. Initial Terms-tap and generic-back driver misses were corrected with settled native text selectors and explicit iOS back controls before the final passing runs; no app mutation or reset was used.
- Native small-screen inspection verified neutral OFF switch appearance, checked radio indicators, and 44-point radio/back targets. The 31-point-high native switch has seven-point vertical hit slop inside a 44-point wrapper, intended to provide a 44-point target; the parent can clamp hit slop, so edge-hit checks remain manual. UIKit owns the actual switch rendering; numerical renderer color assertions are not native pixel measurements.
- Maximum accessibility text was inspected in both themes: stacked Appearance/Units and title remain reachable without horizontal clipping. Long words can wrap at extreme sizes. The simulator was restored to normal `large` text, light mode and Home, preserving the active Upper A workout with 4/4 logged sets.
- Permission changes, preference saves, enabled/Premium switch states and destructive account actions are verified with mocks, not performed on the simulator account.

## Manual checks / release boundaries

Physical-iPhone appearance, VoiceOver, hardware keyboard, native ON/Premium states, switch edge-hit checks and live permission/preference saves remain manual checks. Native switches retain their position change and add seven-point vertical hit slop inside 44-point wrappers. This styling PR does not close Apple Health or production release gates.

## Dependencies and rollout

Frontend-only, from updated `main` after U05. U06 correction PR #55 is separate and is not a dependency. Screenshots, renderer tests, native checks and independent code review are complete; keep this PR draft pending acceptance. Reverting this PR restores the prior Settings presentation without changing stored preferences.

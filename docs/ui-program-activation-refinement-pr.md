# Update program activation with calmer choices and adaptive layouts

## Summary

Refine **Use program** to match the accepted logger, Health connections and Program detail direction. Neutral surfaces make the scheduling consequences easier to read, while purple identifies the main Review/Activate action and small, meaningful selected indicators.

This is U10 of the screen-by-screen refinement plan, based on updated `main` at `e8fd225053493f3af5a0eb5c8f7c7c8a96aa257f`. Program detail (#58) and completed-workout correction (#55) are already merged; there is no remaining prerequisite PR.

## Changes

- Move the complete program name into the scrolling content; keep Back reachable with a compact, adaptive local header.
- Show distinct Mon–Sun labels in wrapping controls with at least 44-point targets. Selected days retain their checkbox state, a small check and a contrasting border instead of a filled purple tile.
- Use neutral start-mode cards with readable consequences and selected radio indicators. Stack the cards at larger text sizes.
- Keep schedule dates, preserved/replaced-workout counts and equipment explanations readable in both themes.
- Stack replacement names and Suggested labels instead of squeezing a long exercise name beside a tag. Preserve duplicate-choice filtering and same-workout exclusion.
- Keep current/scheduled status, equipment success, unresolved-equipment warnings and errors semantic and visible.
- Make Review/Activate the opaque main action when enabled; busy/disabled actions remain neutral and readable rather than fading the entire control.
- Use uncapped native text metrics, top/bottom safe areas and scrolling loading/unavailable states, scoped to this route.

## Screenshots

Original iPhone 16 Plus screenshots, shown at phone-friendly width. These are unchanged native captures, not composited, retouched or recreated from mock data. Setup and the matched review images use **Start now**; the read-only automated flow also verifies **Start next week** separately.

### After — Light

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-light-setup.png" width="320" alt="Light appearance after: neutral weekday and start-mode choices, readable instructions and purple Review schedule action" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-light-now-review.png" width="320" alt="Light appearance after: this-week schedule consequences and readable equipment conflicts" />

### After — Dark

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-dark-setup.png" width="320" alt="Dark appearance after: neutral choices and small purple selected indicators" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/after-dark-review.png" width="320" alt="Dark appearance after: this-week schedule consequences and equipment review" />

<details>
<summary>Before — Light and Dark</summary>

The previous screen concentrated purple in weekday fills, mode text/tints and informational icons, with lighter descriptions. These genuine baseline images show the same program, fixture and Start now presentation.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-before-light-setup.png" width="320" alt="Light setup before refinement" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-before-light-review.png" width="320" alt="Light schedule review before refinement" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-before-dark-setup.png" width="320" alt="Dark setup before refinement" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-before-dark-review.png" width="320" alt="Dark schedule review before refinement" />

</details>

<details>
<summary>Maximum text — Before and After in both themes</summary>

The old fixed header truncated the program name. The new full name scrolls with the content; weekdays wrap, and start-mode cards stack. These are different scroll positions, not a claim that all content fits in one viewport.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-before-light-max-top.png" width="320" alt="Light maximum-text baseline with truncated fixed header" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-before-dark-max-top.png" width="320" alt="Dark maximum-text baseline with truncated fixed header" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-light-max-top.png" width="320" alt="Light maximum-text full program name in scrolling content" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-dark-max-top.png" width="320" alt="Dark maximum-text full program name in scrolling content" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-light-max-weekdays.png" width="320" alt="Light maximum-text all seven weekday controls wrap within the screen" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-dark-max-weekdays.png" width="320" alt="Dark maximum-text all seven weekday controls wrap within the screen" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-light-max-modes.png" width="320" alt="Light maximum-text stacked start-mode cards" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-dark-max-modes.png" width="320" alt="Dark maximum-text stacked start-mode cards" />

</details>

<details>
<summary>Unresolved-equipment safety state and small-screen check</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/u10-dark-unresolved.png" width="320" alt="Unresolved equipment remains visible and Activate is disabled" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u10/after-se-light-setup.png" width="320" alt="Small iPhone SE normal-text setup with contained weekday choices" />

</details>

## Behavior preserved

The controller from authentication through unresolved-conflict derivation is byte-identical to the approved base. Default weekday selection and the equipment choices/deduplication block are also unchanged. Existing action handlers, route parameters, test IDs, preview payloads, per-day duplicate restrictions, stable activation operation IDs, busy/disabled guards and stale-account/input protections are retained.

Starting now still replaces unfinished workouts; starting next week still leaves this week untouched. Previewing does not activate a program. A canonical current-week response is installed only on the original path; a mismatched week is refreshed, and scheduling next week does not overwrite the visible week.

No backend/API, migration, database, Health permission/collection/export, storage, shared theme or shared ProgramHeader/ScreenState default changes. No new dependency, analytics payload or idle animation.

## Verification

```sh
node --test scripts/test-program-activation-ui.mjs
node --test scripts/test-program-activation-ui.mjs scripts/test-program-detail-ui.mjs scripts/test-catalog-ui.mjs scripts/test-explore-ui.mjs scripts/test-training-preferences-ui.mjs scripts/test-settings-ui.mjs scripts/test-workout-correction-ui.mjs scripts/test-health-ui.mjs scripts/test-health-export.mjs scripts/test-offline-health-export.mjs scripts/test-health-read-sync.mjs scripts/test-health-account-deletion.mjs scripts/test-offline-finish.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs scripts/test-profile.mjs scripts/test-exercise-foundation.mjs
npm run lint
npm run typecheck
npm run audit:ui-actions
npm run test:audit-ui-actions
EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --output-dir /private/tmp/primerep-u10-web
git diff --check
```

- **28/28 focused renderer/action tests passed**, using the actual route and native text wrappers with mocked services. Coverage includes both themes, selected/pressed contrast, minimum touch targets, large text, meaningful states, frequency/defaults, same-day duplicate replacements, unresolved conflicts, failed preview/retry, automatic equipment review, stable operation retry/reset, canonical-week handling, repeated submissions, stale load/preview/activation responses, account/route/unmount fencing and local calendar boundaries.
- **255/255 distinct combined regression checks passed**, independently verified. The focused 28 are included in this total, not added again.
- Lint, typecheck, UI-action audit and its self-tests passed; HTTPS-configured web export completed for **62 routes**.
- Source assertions prove the controller, default weekdays, equipment-choice deduplication and inline action contracts unchanged.
- Existing react-test-renderer deprecation, baseline-browser-mapping age, NO_COLOR/FORCE_COLOR and web notifications warnings remain unchanged.

Native checks used the installed development app, existing test account and usual local database; no program, schedule, equipment, active-workout or Health-data mutation was performed.

- The read-only Maestro flow passed **2/2 normal-text runs**, Light and Dark, on the iPhone 16 Plus. It checks exact-frequency review gating, local next-week selection, canonical schedule preview, unresolved-equipment safety and disabled Activate, then returns Home with Resume intact.
- Normal-text native bounds: Back **44 × 44 points**, weekdays **52–53 × 50**, and mode cards **188 × 94**.
- Separate maximum-accessibility-text checks in both themes verified the full program name in scrolling content, all seven contained weekday choices, stacked mode cards, readable schedule consequences and unresolved-equipment warning text. Weekdays measured **189 × 90–91 points** for Mon–Sat and **386 × 91** for Sun; mode cards measured **386 × 289** and **386 × 301**. These are scrollable positions, not a single-viewport fit or a rerun of the normal-text flow at maximum text.
- The complete eight-conflict maximum-text review was not traversed to its final Activate control. No native final activation or compatible replacement-radio interaction is claimed.

- A separate **375-point iPhone SE normal-text layout check** showed all seven weekday labels/choices contained, wrapping mode descriptions and a reachable Review action. Native bounds: Back **44 × 44 points**, weekdays **44–45 × 51**, mode cards **160–161 × 112**, and Review **331 × 54**. This is a layout inspection, not an additional complete Maestro run.

Both simulators were restored to normal text with the same **Upper A, 4/4 sets** active workout intact. The secondary iPhone SE is at Light / Home; the primary iPhone 16 Plus is back in its original Dark appearance with Use program setup raised for manual review. No activation was submitted.

## Known limits and manual acceptance

- The read-only native fixture has unresolved equipment conflicts and no compatible replacement choices. Replacement radios, compatible/current/scheduled states, final activation, failures and account races are exercised through actual source callbacks with mocked services, not asserted as real native mutation tests.
- Physical iPhone, VoiceOver traversal and signed-release acceptance remain manual gates. This styling PR does not close the separate Part 9/Part 10 release gates.
- The existing unavailable-load message behavior is not fixed or reinterpreted here. It is a separate controller follow-up; this PR preserves that controller exactly.

## Rollout and rollback

Frontend-only presentation update; no feature flag or data migration is required. Reverting this PR restores the previous activation presentation without changing programs, schedules, workout snapshots or Health records. Keep this PR separate from the next screen slice and merge only after screenshot/design approval.

# Refine Training Preferences layout and selected controls

## Summary

Match the calmer logger and Settings design without changing the training workflow. Selected choices now use neutral surfaces and visible checks; **Save preferences** remains the primary purple action. Larger text can scroll instead of overlapping the screen or equipment-picker header.

## Screenshots

Original iPhone SE (3rd generation) simulator captures, 375-point width. Tap a screenshot for its full size. These are unmodified PNGs, not generated mockups or stitched images.

### After — Training Preferences

Light:

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-top.png" width="320" alt="Training Preferences after refinement in light mode, with neutral choices and visible selection checks" /></a>

Dark:

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-top.png" width="320" alt="Training Preferences after refinement in dark mode, with neutral choices and visible selection checks" /></a>

### After — Equipment picker

Light:

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-picker.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-picker.png" width="320" alt="Equipment picker after refinement in light mode, showing neutral tabs and searchable equipment" /></a>

Dark:

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-picker.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-picker.png" width="320" alt="Equipment picker after refinement in dark mode, showing neutral tabs and searchable equipment" /></a>

<details>
<summary>Before — Training Preferences in both themes</summary>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-light-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-light-top.png" width="320" alt="Training Preferences before refinement in light mode, with purple selected chips" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-dark-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-dark-top.png" width="320" alt="Training Preferences before refinement in dark mode, with purple selected chips" /></a>

</details>

<details>
<summary>Maximum accessibility text — before, after, and focused search</summary>

Before: the fixed equipment header overflowed the screen and made Done unreachable. These captures demonstrate the baseline defect; they do not represent a passing test.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-light-max-picker.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-light-max-picker.png" width="320" alt="Before, maximum-text light equipment picker with overflowing fixed title and hidden Done action" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-dark-max-picker.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-before-dark-max-picker.png" width="320" alt="Before, maximum-text dark equipment picker with overflowing fixed title and hidden Done action" /></a>

After: Cancel and Done have full-width targets; title, search, tabs, and results can scroll. Extreme text still wraps naturally rather than being capped or truncated. Final maximum-text result-navigation acceptance remains manual; no result-flow success is claimed from these idle/focused-field captures.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-max-picker-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-max-picker-top.png" width="320" alt="After, maximum-text light equipment picker with full-width Cancel and Done and scrollable title" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-max-picker-top.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-max-picker-top.png" width="320" alt="After, maximum-text dark equipment picker with full-width Cancel and Done and scrollable title" /></a>

Focused search: native keyboard insets keep the entered search visible above the keyboard.

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-max-picker-keyboard.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-light-max-picker-keyboard.png" width="320" alt="After, maximum-text light equipment search fully visible above the keyboard" /></a>

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-max-picker-keyboard.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/feat/ui-training-preferences-refinement/docs/pr-screenshots/u08/u08-after-dark-max-picker-keyboard.png" width="320" alt="After, maximum-text dark equipment search fully visible above the keyboard" /></a>

</details>

## Changes

- Use readable, sentence-case section labels and uncapped native system text.
- Keep selection visible through checks plus radio/checkbox/tab accessibility state, with neutral pressed and selected surfaces in both themes.
- Make custom-workout removal a real 44-point target beside wrapping workout names and muscle descriptions.
- Increase equipment tabs to at least 44 points, retain searchable selected/unselected lists, and stack tabs at larger text sizes.
- Keep picker Cancel and Done reachable while moving its title and content into the scroll region at maximum accessibility text.
- Stack picker Cancel and Done at extreme text sizes so action words remain intact. Native keyboard insets keep focused fields visible in the page sheet without guessed device offsets or double adjustment.
- Use safe-area spacing, keyboard avoidance, first-tap action handling, and drag/outside-tap keyboard dismissal. Equipment names and categories no longer have line caps.
- Preserve the existing load, draft, custom validation, equipment filtering, save payload, local effective dates, week refresh, and navigation handlers.

## Verification

```sh
node --test scripts/test-training-preferences-ui.mjs scripts/test-settings-ui.mjs scripts/test-health-ui.mjs scripts/test-health-export.mjs scripts/test-offline-health-export.mjs scripts/test-health-read-sync.mjs scripts/test-health-account-deletion.mjs scripts/test-offline-finish.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs
node --test scripts/test-profile.mjs
node --test scripts/test-exercise-foundation.mjs
npm run lint
npm run typecheck
npm run audit:ui-actions
npm run test:audit-ui-actions
EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --output-dir /private/tmp/primerep-u08-web
git diff --check
```

- Primary suite: **119/119 checks passed**, including 19 new Training Preferences renderer tests.
- Separate Profile regression: **18/18 checks passed**; independent Exercise Foundation regression: **11/11 passed**. These are 148 distinct checks, not repeated runs added together.
- Lint, typecheck, UI-action audit and audit self-tests passed. HTTPS-configured web export completed for 62 routes.
- Source comparison confirms the screen's state, effects, and controller-handler block remains byte-equivalent to its pre-change version.
- Renderer tests execute actual handlers with mocked services: custom validation/add/remove; preference selection; searchable equipment draft, Cancel/reopen/Done; stale catalog IDs and no-catalog payload omission; exact dates and week refresh; repeated taps, failure/retry, loading failure, and no API writes from in-memory controls alone.
- Renderer layout assertions cover both themes, maximum-text contracts, long names/categories, 120-item counts, targets, selected semantics, contrast, and keyboard/first-tap scroll props. These assertions are not a substitute for native or VoiceOver testing.
- Actual pressed-state description contrast is 4.62:1 in light mode and 6.31:1 in dark mode; the primary Save label remains contrast-safe on opaque purple.

### Native acceptance

```sh
maestro --device 2DDB8FAA-6AD5-4890-AD80-80102CFE68B8 test -e APPEARANCE=light .maestro/training-preferences-refinement.yaml
maestro --device 2DDB8FAA-6AD5-4890-AD80-80102CFE68B8 test -e APPEARANCE=dark .maestro/training-preferences-refinement.yaml
```

- Both normal-text flows passed on the isolated 375-point iPhone SE simulator with the existing account and usual local backend. Search, selected/unselected tabs, matching/empty results, Cancel/reopen reset, Back, and Home return were checked. The tracked normal flow does not invoke Done or Save.
- Outside text taps and dragging dismiss the keyboard without losing the `bench` search. Cancel works on its first tap with the keyboard open.
- Separate maximum-text checks in both themes confirmed scrollable titles and fully visible focused search. The field ends at y407, where predictive keyboard content begins, rather than overlapping it by 40 points as the first implementation did.
- Extreme-text Cancel and Done remain intact, full-width targets 335 points wide and at least 84 points tall. First-tap Cancel was checked; preserving native text growth still allows long titles to wrap.
- Restored normal text, light appearance, and Home. The existing Upper A workout remains active with its same four logged sets, saved and synced. No persisted training preference or Health permission/data change was made.
- The 12 committed PNGs total 1,403,900 bytes and match the approved originals byte-for-byte by SHA-256. Maximum-text result/custom-driver artifacts were excluded.

## Known issues and remaining checks

- The pre-existing Training Preferences load/save promises are not response-fenced against an authenticated-account switch. This presentation PR does not introduce or fix that controller issue; it needs a separate account-isolation follow-up.
- A preference update can succeed before the subsequent week refresh fails. The existing failure alert still says the workout plan is unchanged, which may be inaccurate in that sequence. The regression test preserves and identifies this existing behavior; correcting the message/reconciliation needs a separate controller follow-up.
- Physical-iPhone acceptance and VoiceOver focus/traversal remain manual checks.
- Native preference Save, successful custom Add/Remove, and applying a changed equipment selection remain manual. Their handlers are covered by mocks; persisting a changed training plan requires an explicitly approved test workflow.
- One final maximum-text result-navigation driver attempt accidentally tapped Done with an unchanged empty equipment draft. It did not press Save or submit a training-preferences API update. That attempt and its result capture are excluded from passing native evidence; maximum-text result navigation needs manual acceptance.
- Web export retains existing baseline-browser-mapping, color-environment, and web-notification warnings; it completes successfully.

## Dependencies, rollout, and rollback

Frontend-only U08 slice, branched from updated `main` after Settings PR #56. It does not depend on the unmerged completed-workout correction PR #55. No backend API, migration, dependency, shared theme token, permission, Health data, or storage change.

The existing training-preference consequences remain unchanged: saving can update the current week plan; picker Done only applies an in-memory equipment draft; Cancel and leaving the screen do not submit changes. Roll back this screen, its focused tests, and its read-only QA documentation together if needed.

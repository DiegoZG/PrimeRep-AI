# Fix Program builder native press crash

## Summary

Keep Program builder's Create/Save scale transform as an array in every press and busy state. A validation-only Create tap on a verified-empty local draft reproduced a Fabric `processTransform` crash because the previous pressed array became an undefined transform on release.

The action now uses `[{ scale: pressed && !saving ? 0.99 : 1 }]`: the pressed feedback is unchanged, and release/busy states explicitly return to scale 1.

## Before and after

These are unchanged original iPhone 16 Plus screenshots, 1290×2796 pixels. The native check uses an empty local draft and never sends a program-save request.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/builder-press-fix/after-dark.png" width="320" alt="After Dark: repeated Create presses retain Give your program a name validation without a native crash" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/builder-press-fix/after-light.png" width="320" alt="After Light: repeated Create presses retain Give your program a name validation without a native crash" />

<details>
<summary>Before — Confirmed native crash</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/builder-press-fix/before-crash.png" width="320" alt="Before: Fabric processTransform forEach null crash on Program builder Create release" />

</details>

Immutable links are finalized after the asset commit; no screenshot is edited or synthesized.

## Scope and behavior

- One presentation expression changes in `app/programs/builder.tsx`; no handler, validation, request, routing, controller, gesture, theme or shared button change.
- The existing builder UI test cases now assert stable transform arrays for pressed/unpressed, pending-save and failed-save recovery in both themes. The test count is unchanged.
- No API, backend, database, migration, storage, active-workout or Health changes. The native fixture is an empty in-memory draft; invalid Create cannot call the program mutation API.
- U13 Exercise detail work is paused for this separate fix. Its untracked baseline test is deliberately excluded from this PR.

## Verification

```sh
node --test scripts/test-program-builder-ui.mjs scripts/test-program-day-ui.mjs
node --test scripts/test-program-day-ui.mjs scripts/test-program-builder-ui.mjs scripts/test-program-activation-ui.mjs scripts/test-program-detail-ui.mjs scripts/test-catalog-ui.mjs scripts/test-explore-ui.mjs scripts/test-training-preferences-ui.mjs scripts/test-settings-ui.mjs scripts/test-workout-correction-ui.mjs scripts/test-health-ui.mjs scripts/test-health-export.mjs scripts/test-offline-health-export.mjs scripts/test-health-read-sync.mjs scripts/test-health-account-deletion.mjs scripts/test-offline-finish.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs scripts/test-profile.mjs scripts/test-exercise-foundation.mjs
git ls-files 'scripts/test-*.mjs' | rg -v 'scripts/test-ui-action-audit.mjs' | xargs node --test
npm run lint
npm run audit:ui-actions
npm run test:audit-ui-actions
EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --output-dir /private/tmp/primerep-builder-press-web
git diff --check
```

- Focused builder/day tests: **42/42 passed** (22 builder + 20 day).
- **297/297 prior release-regression subset passed**; an independent review also ran every tracked `test-*.mjs` script except the separately run audit self-test: **352/352 distinct tests passed** across 24 files. The 42 focused cases are included in each combined total, not added again. The untracked U13 baseline test is excluded.
- Lint, UI-action audit/self-tests and diff checks passed. HTTPS-configured web export completed for **62 routes**. Existing react-test-renderer deprecation, baseline-browser-mapping age, NO_COLOR/FORCE_COLOR and web-notification warnings remain unchanged.
- Actual native validation flows passed **2/2, Dark and Light**, with two repeated Create presses in each theme on a verified-empty draft. The original name error remained visible without a crash; no program API request was possible. The flow is `.maestro/program-builder-validation.yaml`, with the explicit empty-draft precondition and recorded acceptance in `.maestro/README.md`.
- Typecheck is not rerun for this isolated style-expression fix: types and imports do not change. The merged base passed its typecheck; this does not substitute for native acceptance.

## Native test boundaries

The pre-fix crash occurred on an explicitly verified-empty builder: blank name/description/aliases, General fitness, Beginner, 35 minutes and 0 workout days. No backend Create/Save, activation, account reset or durable-workout cleanup was performed. Crash recovery remounted that already-empty RAM draft; no user draft was cleared for recovery. Final restoration was verified: the primary iPhone 16 Plus uses its original Dark appearance and normal `large` text, the builder is empty with the same defaults, and Home still shows the existing Upper A **4/4** active workout. No saved program, Health choice or durable workout was mutated.

Actual server saves, private/current/scheduled programs, software-keyboard-open first-tap Create/Save, physical-iPhone, VoiceOver and signed-release acceptance are not claimed by this small fix. Busy/save behavior is covered by mocked renderer tests, not an actual backend save. Maximum text and the secondary SE were not newly retested; the SE was left untouched. Existing aliases initialization and post-save Alert account-fencing follow-ups remain unchanged.

## Rollout

Frontend-only branch from merged PR #61 main `5d7eeca0c8e277f4c0424d4d55cb66ec282e14fd`. Review and merge this separate repair before continuing U13 Exercise detail. There is no migration or production feature-flag change.

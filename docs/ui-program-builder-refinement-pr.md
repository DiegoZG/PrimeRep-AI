# Refine Program builder with calmer controls and adaptive layouts

## Summary

U11 of the screen-by-screen refinement plan makes Program builder match the accepted workout logger, Health connections and Program activation direction. Neutral choices and day controls keep attention on the form; purple identifies Create/Save and meaningful moved-day feedback.

Based on updated `main` at `e6e13d361b9212fbd754b1b3e53af0d182bfdd13`. Program activation (#59) is merged; no prerequisite PR remains.

## Changes

- Keep Back in a compact local header and move the complete Build/Edit title and weekly-repeat explanation into the scrolling form.
- Use readable saved values, placeholders and helper text in both themes, with uncapped native system text metrics and top/bottom safe areas.
- Make Goal, Experience and Duration choices neutral, with a check and contrasting border for the selected value.
- Make Add day, day numbering and ordinary icons neutral. At larger text sizes, put the complete day name above the drag handle and Options controls instead of truncating it.
- Keep the existing drag/moved highlight and reduced-motion behavior; measure the full adaptive card for drag stride.
- Bound the existing options sheet to the screen and let its content scroll. Preserve position instructions, boundary-disabled move actions and remove confirmation; destructive controls and errors remain readable red.
- Dismiss the keyboard on outside taps, interactive dragging, Add/Options and Back. Save runs on its first tap with the keyboard open and uses the same controller.
- Keep Create/Save opaque purple when enabled and neutral/readable when busy, without fading the entire control.

## Screenshots

Original native screenshots at phone-friendly width, with the iPhone 16 Plus as the primary preview device and an iPhone SE as the secondary small-screen check. These captures are unchanged, not composited, retouched or recreated from mock data. Before shows empty metadata fields; normal-text After setup/day captures type a generic name and description into the verified-empty in-memory draft so entered text can be reviewed. Maximum-text hero captures use blank fields where appropriate after cleanup. Day-row and Options captures use two disposable, empty local workout days, not a created backend program. The local draft is restored after inspection.

### After — Light

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-light-setup.png" width="320" alt="Light Program builder after: readable fields and neutral goal choices" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-light-days.png" width="320" alt="Light Program builder after: neutral day numbers and Add, clear Create program action" />

### After — Dark

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-dark-setup.png" width="320" alt="Dark Program builder after: readable fields and quiet selected choices" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-dark-days.png" width="320" alt="Dark Program builder after: restrained day controls and primary Create action" />

<details>
<summary>After — Options in both themes</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-light-options.png" width="320" alt="Light workout day options after: readable disabled boundary action and semantic red Remove" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-dark-options.png" width="320" alt="Dark workout day options after: neutral movement and cancel actions" />

</details>

<details>
<summary>Before — Light and Dark</summary>

The previous builder used purple for selected choice text/tints, Add and day numbers, with lighter essential instructions. These are genuine baseline images; the fields are blank rather than the generic typed After draft.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-light-setup.png" width="320" alt="Light builder baseline with blank metadata fields" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-light-days.png" width="320" alt="Light builder baseline with purple Add and day numbers" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-light-options.png" width="320" alt="Light day options baseline" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-dark-setup.png" width="320" alt="Dark builder baseline with blank metadata fields" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-dark-days.png" width="320" alt="Dark builder baseline with purple choices and day controls" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-dark-options.png" width="320" alt="Dark day options baseline" />

</details>

<details>
<summary>Maximum text — Before and After</summary>

The old fixed header truncates the title. The new full title scrolls with the form, day names wrap above their controls, and the options sheet scrolls to Cancel. These are different scroll positions, not a claim that everything fits in one viewport. Extremely large native text can wrap a word mid-word; it is not capped to avoid that. In the options images, the heading is partly above the visible scroll area so the final Cancel action can be shown.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-light-max.png" width="320" alt="Light maximum-text baseline with a truncated fixed title" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-before-dark-max.png" width="320" alt="Dark maximum-text baseline with a truncated fixed title" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-light-max-hero.png" width="320" alt="Light maximum text after: full Build program title and weekly explanation scroll with the form" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-light-max-days.png" width="320" alt="Light maximum text after: full day name above contained drag and Options controls" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-light-max-options.png" width="320" alt="Light maximum text options scrolled to show the final Cancel action" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-dark-max-hero.png" width="320" alt="Dark maximum text after: complete uncapped title in scrolling form" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-dark-max-days.png" width="320" alt="Dark maximum text after: contained day numbering, full day name and separate action row" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-dark-max-options.png" width="320" alt="Dark maximum text options scrolled to show readable actions through Cancel" />

</details>

<details>
<summary>Secondary small-screen check — iPhone SE</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/95e50c66b4b1db49e824b7451e45456371f4ac0e/docs/pr-screenshots/u11/u11-se-days.png" width="320" alt="Small-screen Light builder: contained day row and reachable Create program action" />

</details>

## Behavior preserved

The controller from authentication through save remains byte-identical to the approved base. The reorder hooks, shared values, refs, worklets, measured stride, haptics, accessibility actions and order-key derivation also remain unchanged. The actual account-owned ProgramDraftProvider, shared ProgramHeader/theme, program service and dependencies are unchanged.

Existing validation, aliases normalization, revision-aware update payloads, create/edit routes, current/scheduled Apply now/Next week confirmation, duplicate-submit guards and stale-account/unmount fencing are retained. Options still moves one position at a time, removal still requires confirmation and Add still caps the draft at seven days. No new duplicate-day action is introduced.

No API/backend, migration, database, durable storage, Health permission/collection/export or active-workout changes. The builder draft remains in-memory and account-owned; this PR does not imply restart persistence.

## Verification

```sh
node --test scripts/test-program-builder-ui.mjs
node --test scripts/test-program-builder-ui.mjs scripts/test-program-activation-ui.mjs scripts/test-program-detail-ui.mjs scripts/test-catalog-ui.mjs scripts/test-explore-ui.mjs scripts/test-training-preferences-ui.mjs scripts/test-settings-ui.mjs scripts/test-workout-correction-ui.mjs scripts/test-health-ui.mjs scripts/test-health-export.mjs scripts/test-offline-health-export.mjs scripts/test-health-read-sync.mjs scripts/test-health-account-deletion.mjs scripts/test-offline-finish.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs scripts/test-profile.mjs scripts/test-exercise-foundation.mjs
npm run lint
npm run typecheck
npm run audit:ui-actions
npm run test:audit-ui-actions
EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --output-dir /private/tmp/primerep-u11-web-final
git diff --check
```

- **22/22 focused tests passed**, rendering the actual route and native text wrappers with the actual ProgramDraftProvider and mocked native/service boundaries. Coverage includes both themes, contrast, selected/pressed/disabled controls, target sizes, large text, keyboard dismissal and first-tap Save; normalized create/update payloads; current/scheduled choices; all existing validation messages; errors/409/retry; account/unmount fences; add cap and day navigation; actual sequential draft reorder/remove; measured multi-slot drag, cancellation, reduced-motion timing and accessible moves.
- **277/277 distinct combined regressions passed**. The focused 22 are included in this total, not added again.
- Lint, typecheck, UI-action audit/self-tests and diff checks passed. HTTPS-configured web export completed for **62 routes**.
- Byte assertions verify the full save/controller and reorder-controller prefixes plus unchanged draft provider, shared header, theme, program service and package contract.
- Existing react-test-renderer deprecation, baseline-browser-mapping age, NO_COLOR/FORCE_COLOR and web-notifications warnings remain unchanged.

Independent source/anti-pattern review and the automated gates passed. Native checks used the installed development app, existing test account and usual local database; no saved program, schedule, workout or Health data was changed.

- The local-only Maestro flow passed **2/2 normal-text runs**, Light and Dark, on the iPhone 16 Plus. It typed only generic local draft metadata, added two local blank days, inspected Options and Cancel, then explicitly removed only its disposable days and cleared its input. No Create/Save API request or draft reset was used.
- Native software-keyboard checks verified that tapping the fixed header title and its empty background dismisses the keyboard while preserving the typed draft; the disposable input was then cleared.
- Normal-text iPhone 16 Plus bounds: Back **44 × 44 points**, inputs **50/110/50 points tall** and choices **45–46 points tall**.
- Separate maximum-text positional checks in both themes show a complete scrolling title, contained day names and separate drag/Options controls, plus a sheet scrolled through its final Cancel action. This is not a claim that all content fits at once or that the normal flow was rerun at maximum text. Back/Add/handle/Options measured **44 × 44 points**; the maximum-text day edit target measured **370 × 133**, with sheet Move/Cancel **97 points tall** and wrapping Remove **165 points tall**.
- A separate **375-point iPhone SE Light/normal-text layout check** verified Back/Add/handle/Options **44 × 44**, day edit **227 × 64**, and Create **331 × 56**. Create was not pressed; this is a layout/target inspection, not another complete Maestro run or a backend mutation test.

Both simulators were restored to their original normal **large** system text setting, with the same **Upper A, 4/4 sets** active workout visually confirmed. The primary iPhone 16 Plus is in its original Dark appearance, with a verified-empty builder ready for manual review: blank name/description/aliases, default choices and **0/7 days**. The secondary iPhone SE is Light/Home. Final restoration was independently verified with native screenshots and accessibility hierarchy, not claimed as a passing final navigation-driver assertion.

## Known limits and manual acceptance

- Native checks use the usual local database and existing test account. They must not save/create a backend program, activate a schedule, change a workout or access Health data. Any disposable draft used for layout inspection is local-only and restored afterward.
- Real backend create/update, current/scheduled save prompts, failures and account races are covered through actual source callbacks with mocked service boundaries, not claimed as native backend mutation tests. Drag calculations, cancellation, reduced-motion configuration and accessible reorder callbacks are renderer checks, not a native drag-and-drop, haptic-delivery or VoiceOver traversal test.
- The pre-existing mount-only aliases field initialization and account fencing of an already-presented save-success Alert callback are separate controller follow-ups; they are not changed by this presentation PR.
- First-tap Save is verified through the actual renderer callback and mocked service boundary. Any native validation-only Save check is not a real backend save; no native backend save is claimed.
- Physical iPhone, VoiceOver traversal, hardware-keyboard interaction and signed-release acceptance remain manual gates. This PR does not close Part 9/Part 10 release gates.

## Rollout and rollback

Frontend-only presentation update; no feature flag or data migration. Reverting this PR restores the previous builder layout without changing saved programs, schedules, workout snapshots or Health records. Keep this slice separate from Program day editor and merge only after screenshot/design approval.

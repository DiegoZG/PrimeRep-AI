# Refine Program day editing with calmer, accessible controls

## Summary

- Match Program builder and the refined logger: neutral exercise initials, Add/Choose actions and prescription cards. Purple identifies Done, which validates the local day and returns to the builder; it does not save a program to the backend.
- Keep Main/Accessory selection explicit with a check and a contrasting neutral border. Raise both controls to at least 44 points, retain accessible selected states and use readable destructive/disabled treatments.
- Make the four prescription fields adapt from four columns on the normal iPhone 16 Plus to two on narrow or larger-text layouts and one at maximum text. Increase field labels to 14 points and retain natural native text metrics.
- Keep Done reachable in an adaptive local header, show the full day heading and exercise count in the scrollable form, and account for both safe areas. Tapping outside inputs or dragging dismisses the keyboard; Done handles the first tap while the keyboard is open.
- Preserve all existing validation, field values, training cues, removal, accessible order controls and account-owned draft behavior.

## Screenshots

The following Light/Dark After images were captured after the native transform repair and approved at original resolution. All 15 Before/After captures are genuine, unmodified originals: 14 from iPhone 16 Plus and one from the secondary iPhone SE. They show an explicitly disposable local Day 1 draft and public exercises, not private program or Health data. No program was saved, activated or seeded in the backend. Final image URLs will be pinned to the immutable feature commit before publication.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-light-populated.png" width="320" alt="Light after: neutral exercise tile, readable prescription labels, outlined Add and checked Main selection" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-dark-populated.png" width="320" alt="Dark after: neutral exercise tile, readable prescription labels, outlined Add and checked Main selection" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-light-empty.png" width="320" alt="Light after: neutral empty-day guidance and purple Done as the sole primary action" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-dark-empty.png" width="320" alt="Dark after: neutral empty-day guidance and purple Done as the sole primary action" />

<details>
<summary>Before — Light and Dark</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-before-light-empty.png" width="320" alt="Light baseline: empty workout day and purple Add and Choose actions" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-before-dark-empty.png" width="320" alt="Dark baseline: empty workout day and competing purple actions" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-before-light-populated.png" width="320" alt="Light baseline: cyan exercise initials and small prescription labels" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-before-dark-populated.png" width="320" alt="Dark baseline: tinted initials and purple Main selection" />

</details>

<details>
<summary>Before — Maximum native text</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-before-light-max.png" width="320" alt="Light maximum-text baseline: truncated header and clipped Done and exercise initials" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-before-dark-max.png" width="320" alt="Dark maximum-text baseline: clipped header action and cramped prescription fields" />

</details>

<details>
<summary>After — Maximum native text</summary>

These are different scroll positions, not a claim that the entire form fits in one viewport. Native text remains uncapped; at the largest sizes, a word can naturally wrap mid-word. The header keeps Done contained while the complete title and form scroll beneath it. All four values are visible in the field images; the Sets label is partly above the viewport because the form was scrolled to the fields, not because its text is capped.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-light-max-hero.png" width="320" alt="Light maximum text after: fully visible Done, complete uncapped scrolling title and stacked neutral Add" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-dark-max-hero.png" width="320" alt="Dark maximum text after: complete scrolling title with natural word wrapping and contained Done" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-light-max-fields.png" width="320" alt="Light maximum-text form scrolled to all four vertically stacked prescription values; Sets label partly above the viewport" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-dark-max-fields.png" width="320" alt="Dark maximum-text form scrolled to all four vertical fields with fully contained Done" />

</details>

<details>
<summary>Secondary small-screen check — iPhone SE</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u12/u12-se-normal.png" width="320" alt="375-point Light layout: two prescription columns with all four labels and values visible and a contained Done action" />

</details>

## Behavior preserved

The full local validation controller, from the draft-provider destructuring through `finishEditing`, remains byte-identical to the approved main base. Prescription types, labels and limits also remain byte-identical. Numeric entry still accepts only digits, stores local strings until blur/submit/Done, normalizes integers on successful commit and retains invalid values with the original inline errors.

Limits remain Sets 1–20, Min/Max reps 1–100, Min reps no greater than Max reps, and Rest 0–900 seconds. Done commits the existing exercise sequence and returns only after valid entries. Existing Add/Choose routes, block and cue updates, immediate removal, order-boundary disabling and sequential move semantics remain unchanged, including each exercise's stable local identity.

The shared ProgramDraftProvider, ProgramHeader, ScreenState, theme, program service and package contract remain unchanged. This is presentation-only: no API/backend, database, migration, persistence, permissions, Health collection/export or active-workout changes. Program drafts remain in-memory and account-owned.

## Verification

```sh
node --test scripts/test-program-day-ui.mjs
node --test scripts/test-program-day-ui.mjs scripts/test-program-builder-ui.mjs scripts/test-program-activation-ui.mjs scripts/test-program-detail-ui.mjs scripts/test-catalog-ui.mjs scripts/test-explore-ui.mjs scripts/test-training-preferences-ui.mjs scripts/test-settings-ui.mjs scripts/test-workout-correction-ui.mjs scripts/test-health-ui.mjs scripts/test-health-export.mjs scripts/test-offline-health-export.mjs scripts/test-health-read-sync.mjs scripts/test-health-account-deletion.mjs scripts/test-offline-finish.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs scripts/test-profile.mjs scripts/test-exercise-foundation.mjs
npm run lint
npm run typecheck
npm run audit:ui-actions
npm run test:audit-ui-actions
EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --output-dir /private/tmp/primerep-u12-web-final
git diff --check
```

- **20/20 focused tests passed**, rendering the actual route and actual ProgramDraftProvider with native/router boundaries mocked. Eleven behavior cases passed against the unchanged baseline before styling: digit filtering, all range boundaries and invalid/empty values, Min/Max errors and retry, blur/submit/Done, sequential partial commits, immediate title/cue/block edits, exercise-identity-preserving reorder/removal, picker routes, empty/missing day, account switch and existing Back behavior. Nine UI cases cover both themes, selected/pressed/disabled controls and contrast, readable fields, adaptive columns, uncapped text, safe areas, outside/drag dismissal and first-tap Done with valid/invalid entries.
- Lint, typecheck, UI-action audit/self-tests and diff checks passed.
- **297/297 distinct combined regressions passed**. The focused 20 are included in this total, not added twice.
- HTTPS-configured web export completed for **62 routes**. Existing react-test-renderer deprecation, baseline-browser-mapping age, NO_COLOR/FORCE_COLOR and web-notifications warnings remain unchanged.
- Native **Dark manual acceptance passed after the repair**, with the software keyboard visible: Sets `0` then the first Done tap retained the invalid value and inline error without a render crash; correcting to `4` with a generic local cue then tapping Done returned to the builder, and reopening the day retained both values.
- A separate **Light software-keyboard first-tap Done check passed**: Sets `4` was retained after Done and reopening the day. Tapping the Light scroll hero dismissed the numeric keypad without losing `4`; tapping the Dark header outside the field dismissed the alphabet keyboard without losing the generic local cue. These are actual native UI checks, separate from the structural Maestro flows.
- The narrowed **normal-text structural Maestro flows passed 2/2, Light and Dark**, after the repair: Done/reopen, block selection, adding two public exercises, sequential order controls, removal, explicit local draft cleanup and Home Resume. Numeric software-keyboard invalid/valid editing was tested separately through native UI, not represented as part of those structural runner passes.
- Actual normal-text iPhone 16 Plus native bounds: Back **44×44**, Done **73×44**, Add **87×44**, Remove **44×44**, four numeric inputs **81×50**, Main/Accessory **176×44** and Up/Down **44×44** points. Native text/input bounds can differ from renderer style minima; these are measured native targets, not inferred pixels.
- Focused maximum-text checks passed in **both themes**: all four prescription fields stack at the same horizontal position, each **358×92** points, and Done remains fully contained at **171×88** in a **108-point** header; Back remains **44×44**. Full title/field screenshots were captured at different scroll positions.
- The secondary **375-point iPhone SE focused field/Done check passed**: two numeric columns show all four labels and values; field targets measure **144–145×50**, Back **44×44**, and Done **73×44** points. Its broader setup flow did not pass a visibility assertion, so this is a focused layout check, not a full secondary structural-flow pass.
- The native first-tap check caught a Fabric crash when Done's pressed transform changed from an array to an undefined value. Done now always supplies a stable scale-transform array; both pressed states are asserted in the focused tests, and the repaired first-tap action passed the actual Dark check above.
- The **original broader numeric Maestro attempt did not pass**: with the cursor at the beginning of the numeric field, its bounded erase left the original `3`, so typing `0` produced `03`. The current authored narrowed structural flow passed 2/2 as described above; numeric editing was checked separately through actual native UI. Do not interpret those structural passes or syntax validation as an automated numeric-keyboard acceptance pass.
- Physical-iPhone, VoiceOver, hardware-keyboard and signed-release acceptance remain manual. Existing private/current/scheduled program drafts and actual backend program-save requests were not exercised in U12 native checks; no training plan, Health choice or durable active workout was changed. Those broader paths are not claimed as native passes by this presentation-only PR.
- Final native restoration was verified: both simulators use normal `large` text and retain the same Upper A **4/4** active workout. The primary 16 Plus is back in its original Dark appearance with a verified-empty builder (blank name/description/aliases, General fitness, Beginner, 35 minutes, 0 days); the secondary SE is Light/Home. The initial Fabric crash recovery remounted the in-memory draft empty, which was verified before fresh setup; it was not intentional UI cleanup. Successful post-repair fixtures had their disposable local days, exercises and numeric/cue edits explicitly removed or restored before planned restarts. No backend Create/Save, activation, Health or active-workout mutation was used for cleanup.

## Existing follow-ups, not changed here

- Back has never explicitly committed or validated unblurred numeric draft strings. Native blur can commit independently; this PR does not add a new Back-save contract.
- Done validates/commits exercises sequentially. Earlier valid exercises may be committed locally before a later invalid row stops navigation; the batch is not atomic.
- Prescription-string/error state lives in the mounted editor. The provider isolates account-owned draft data and makes an old route unavailable after an account switch, but this PR does not introduce independent editor-state fencing or persistence.

## Dependencies and rollout

Frontend-only U12, based on merged Program builder PR #60 (`230569113fb6bbd5dd46a0340e6bd0533f64e930`). No backend deploy or migration is required. Review this PR separately before continuing to the next UI slice. The broader Part 9/10 release and signed-device gates remain separate.

# Refine Exercise detail with quieter, readable information

## Summary

- Match the refined logger and program screens: neutral exercise type, muscle and equipment cards/icons, readable muted labels and quiet Retry/Edit actions. Keep favorite feedback red, archive/errors semantically destructive, and Demo/Send as meaningful primary actions.
- Enlarge visible Back/favorite controls to 44 points, use both safe areas, and keep native text uncapped. At accessibility font scales of 2 or more, the header contains controls only while the complete exercise name remains scrollable.
- Keep instructions and beginner notes readable with natural native text metrics, wrapping titles, neutral highlight borders and accessible 44-point disclosure controls.
- Make the detail Q&A thread use neutral question bubbles, readable hints and errors, and a visible 44-point Send control. Retain question/answer alignment, exact wording, loading, submission and retry behavior.
- Use the media component's existing height and colors props to keep its caption readable and prevent the confirmed maximum-text placeholder overlap. The media implementation and playback lifecycle are unchanged.
- Support first-tap actions while the keyboard is open, native keyboard insets, iOS interactive/Android drag dismissal, and outside-header/body dismissal without discarding question drafts.

## Screenshots

All 15 captures are genuine, unmodified originals: 14 from iPhone 16 Plus and one secondary iPhone SE. They show the public Crunch Machine exercise with its real unavailable-demo state and displayed empty Q&A view; the empty display alone is not proof of an empty server-side thread. No private workout, question history or Health data is included. Before has an unavailable demonstration, not invented media or a muscle diagram. Image links will be pinned to the immutable feature/assets commit before publication.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-light-info.png" width="320" alt="Light after: readable exercise information with neutral type, muscle and equipment controls" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-dark-info.png" width="320" alt="Dark after: quiet informational icon tiles and readable neutral labels" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-light-ask.png" width="320" alt="Light after: neutral instruction disclosures and displayed empty Q&A view with a visible 44-point Send control" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-dark-ask.png" width="320" alt="Dark after: readable instructions and Q&A hint with restrained Send action" />

<details>
<summary>Before — Light, Dark and maximum native text</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-before-light-info.png" width="320" alt="Light baseline: colored informational icons and exercise type" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-before-dark-info.png" width="320" alt="Dark baseline: purple type and primary muscle with green equipment icon" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-before-light-ask.png" width="320" alt="Light baseline: unavailable demonstration, collapsible instructions and empty Q&A" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-before-dark-ask.png" width="320" alt="Dark baseline: instructions and empty Q&A with its small visible Send circle" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-before-dark-max-info.png" width="320" alt="Maximum-text baseline: wrapped Exercise header and overlapping unavailable-demo placeholder in the fixed-height media box" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-before-dark-max-ask.png" width="320" alt="Maximum-text baseline: enlarged Q&A copy and 36-point visible Send circle" />

</details>

<details>
<summary>After — Maximum native text</summary>

These are separate scroll positions, not a claim that the entire page fits in one viewport. Native text stays uncapped. The controls-only header leaves the full exercise name in scrolling content below the media, below the first screenshot's fold. The partly visible preceding Common mistakes disclosure in the Q&A images reflects the scroll position, not clipped text or a capped label.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-light-max-info.png" width="320" alt="Light maximum text after: contained header controls and full unavailable-demo placeholder without overlapping text; exercise name below the fold" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-dark-max-info.png" width="320" alt="Dark maximum text after: readable demonstration placeholder in its adaptive-height media card" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-light-max-ask.png" width="320" alt="Light maximum text after: naturally wrapping Q&A copy and visible 44-point Send; preceding disclosure partially above the scroll position" />
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-dark-max-ask.png" width="320" alt="Dark maximum text after: readable Q&A copy and empty question input with contained Send control" />

</details>

<details>
<summary>Secondary narrow-layout inspection — iPhone SE</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u13/u13-se-info.png" width="320" alt="375-point Light layout: readable neutral exercise information and contained header controls" />

This is a successful narrow-layout inspection, not a full secondary flow pass. Equipment continues partly below the screenshot viewport because the page scrolls. The broader SE runner reached and expanded How to perform but failed an instruction-paragraph visibility assertion below the viewport; the full SE flow remains a manual check.

</details>

## Behavior and scope

The route's complete fetch, account/focus fencing, equipment resolution, favorite and custom archive controllers remain byte-identical to approved main. Favorite's original `#FF4B4B` remains unchanged. Equipment still distinguishes bodyweight, pending names, unresolved IDs and failed name loading without inventing data. Existing content, missing-content behavior, beginner gating, custom Edit/Archive routes and confirmations remain intact.

Shared ContentSection and ExerciseAskThread have an optional `detailPresentation` prop that defaults to false and is enabled only by Exercise detail. Actual historical-versus-current host-tree tests prove omitted and false modes retain legacy rendering in both themes. Their other caller files are byte-identical. Content's initial expanded/collapsed and highlighted states are unchanged; Q&A's loading, cancellation, oldest-first ordering, trimmed send, repeat guard and friendly-error controllers remain byte-identical.

ExerciseMedia is byte-identical. Only this route passes a readable placeholder color and an existing height prop: 220 at normal text, `Math.round(220 * fontScale)` at scales of 2 or more. Approved media URLs, keys, type detection, inline player and external-link behavior are not rewritten.

No backend/API, database, migration, storage, permissions, AI provider, Health data, active-workout or shared-theme changes. No fonts or navigation shell were added. No question was submitted to the actual AI service during native testing, and no real favorite or archive mutation is needed for the presentation checks.

## Verification

```sh
node --test scripts/test-exercise-detail-ui.mjs
node --test $(git ls-files 'scripts/test-*.mjs' | rg -v '/test-ui-action-audit.mjs$') scripts/test-exercise-detail-ui.mjs
npm run lint
npm run typecheck
npm run audit:ui-actions
npm run test:audit-ui-actions
EXPO_PUBLIC_API_URL=https://api.example.com npx expo export --platform web --output-dir /private/tmp/primerep-u13-web-frozen
git diff --check
```

- **26/26 focused tests passed**, including eleven behavior cases run against unchanged main before styling. Real route/ContentSection/ExerciseAskThread components are rendered with native/router/service boundaries mocked; requests and validation are not replaced by source-only assertions.
- Actual legacy-tree comparisons cover both themes and omitted/false opt-in modes for collapsed, expanded, highlighted, guest, empty and populated states. Real Q&A coverage verifies oldest-first ordering, trimmed sends, repeat guards, blank/missing-token guards, pending-load unmount cancellation, 429/503/generic failures, retained drafts and retries.
- UI checks cover normal/narrow/large-text structure, neutral and semantic colors, text contrast, visible 44-point controls, safe areas, existing adaptive media props and outside/drag/first-tap keyboard contracts, including iOS/Android/web dismissal modes. Full route and Q&A controller-byte guards and unchanged shared-caller/media/theme/service/package guards passed.
- Lint, typecheck, UI-action audit/self-tests and diff checks passed. The HTTPS-configured web export completed for **62 routes**. Existing react-test-renderer and baseline-browser-mapping warnings are not new failures.
- **378/378 distinct combined regressions passed**: the 352 tracked baseline cases plus the new focused 26, counted once; the standalone UI-action audit self-test ran separately.
- Actual software-keyboard checks passed for tapping the header/body outside the input and retaining the typed draft. Dragging dismissed the keyboard. Exact draft-text retention after drag was not independently verified because the runner's appended-text expectation mismatched the actual string; do not interpret dismissal as a complete drag-retention pass. The generic unsent test text was never sent to the actual question service.
- Focused maximum-text inspection passed in both themes: the existing media height prop prevents the confirmed placeholder overlap, header controls stay contained, and Q&A text uses natural metrics without a font cap. Different screenshot scroll positions do not claim the full page fits in one viewport.
- The secondary **375-point iPhone SE narrow-layout inspection passed**, but its broader read-only flow did not: it reached the instruction disclosure, then failed a below-viewport paragraph visibility assertion. No full SE runner pass is claimed.
- The authored primary **normal-text read-only flows passed 2/2, Light and Dark**: public exercise detail, instruction expand/collapse, Q&A view and safe return Home. Measured native targets: Back **44×44**, Favorite **44×44**, and How to perform **388×46** points. The previous visible 40-point header/36-point Send controls already had hitSlop; this PR enlarges their visible faces and does not claim their previous effective touch areas were necessarily smaller than 44.
- Final restoration was verified on both simulators: original app appearances **Dark on iPhone 16 Plus and Light on SE**, original OS Light and normal `large` text, both Home screens retaining the same **Upper A 4/4** active workout. The generic unsent question draft was explicitly cleared and Send disabled. Final Home evidence is private and is not included in these public PR screenshots. No workout, program, Health choice, account or real Q&A/favorite/archive mutation was performed.
- Physical iPhone, full SE flow, VoiceOver, hardware keyboard, real question submission, actual favorite/archive mutations and signed-release acceptance remain manual, not claimed native passes.

## Existing follow-ups, not changed here

- Favorite requests do not independently fence their completion by account or exercise identity. Same-account detail requests are not sequence-fenced across rapidly changing exercise IDs. These are separate controller follow-ups, not new guarantees of this visual refinement.
- Q&A does not clear old mounted thread state immediately when account/exercise identity changes, and in-flight send completion does not independently fence identity/unmount. The existing load cancellation remains intact; this PR does not claim to solve those broader account-isolation gaps.

## Dependencies and rollout

Frontend-only U13 from merged builder press repair PR #62, main `3036d5dbbb2111684a14f964f5c822eb891a2578`. No backend deploy or migration is required. Review and merge this screen separately before U14 Login. Part 9/10 infrastructure, privacy/platform and signed-device release gates remain separate.

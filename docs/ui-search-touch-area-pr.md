# Make shared Search touch targets easier to focus

Editable Search has a larger native text target and responds to icon/padding taps. It retains the compact neutral styling, system text, purple focus feedback, and existing search/navigation behavior.

Plus Light/normal — native input grows from 19 to 44 points:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-before-plus-search-light-large.png" width="320" alt="Before: Plus Light normal Search,19-point input">
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-plus-light-large.png" width="320" alt="After: matched Plus Light normal Search,44-point input">

<details>
<summary>Compact comparison — See-all input 20 → 44 points</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-before-compact-see-all-light-large.png" width="320" alt="Before: SE Light normal See-all,20-point input">
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-compact-light-large.png" width="320" alt="After: matched SE Light normal See-all,44-point input">

</details>

<details>
<summary>Same padding tap — blurred BEFORE, focused AFTER</summary>

The same 50%,13% point was above the original input and did not focus it. It is inside the grown input afterward and opens the keyboard; these intentionally compare the same action, not the same keyboard state.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-before-matched-padding-nonfocus.png" width="320" alt="Before: actual padding tap leaves Search blurred without a keyboard">
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-matched-padding-focus.png" width="320" alt="After: same tap focuses the grown input and opens the keyboard">

</details>

<details>
<summary>Remaining final configurations and icon-focus check</summary>

Dark/normal Search; Light/MAX See-all; Dark/MAX Search. MAX native inputs measure 93 points. These are final configurations, not fabricated Dark/MAX BEFORE pairs.

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-plus-dark-large.png" width="320" alt="Final Plus Dark normal Search">
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-plus-light-max.png" width="320" alt="Final Plus Light maximum-text See-all,93-point input">
<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-plus-dark-max.png" width="320" alt="Final Plus Dark maximum-text Search,93-point input">

Separate icon tap outside the input also focuses it, exercising the ref-based shell action:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/shared-search-after-icon-focus.png" width="320" alt="Final icon tap outside the text input shows caret, purple focus, and keyboard">

</details>

## Scope

One shared component redistributes its existing vertical padding into an editable input with `minHeight:44`, without fixed heights or user-text font caps. A non-accessible shell delegates taps to the native input ref; the input retains caret/focus ownership. `tabIndex={-1}` removes the unnamed web tab stop that `focusable={false}` alone did not prevent.

Public props, navigation-mode geometry/action, exact focus spring/timing, controlled query callbacks, read-only behavior, and all four caller routes remain unchanged. No provider, filtering, selection, cache, API, or dependency upgrade is included. Tests add one 22-case harness and adapt only two shared hashes/four named Retry selectors in existing route harnesses, preserving every business case/assertion.

## Verification

- Author and independent engineering: 22 focused cases; 974 named checks plus the audit self-test runner once = 975 standard checks. The 136 existing four-caller cases are included, not extra totals. Real RN-web 0.21.2 server rendering proves predecessor shell `tabindex="0"` versus final `-1`, with the named editable input retained.
- TypeScript, scoped lint, interaction audit/self-test, and whitespace checks pass. Normal lint retains two inherited hook warnings. Fresh cleared, dotenv-disabled HTTPS web exports produce 62 HTML files with actual compiled-module checks.
- Five native configurations TOTAL on fictional iOS 18.5 fixtures: Plus Light/Dark normal, Plus Light/Dark MAX, and SE Light normal. Native inputs measure 44 points normal/compact and 93 at MAX, with one named input. Search/See-all focus, filtered query, exact 4/3-character erase, and blank-tap dismissal were observed without selection actions. One actual Equipment Search tap navigates without a keyboard; native callback counts were not instrumented.
- Ten canonical PNGs are unedited raw copies. Full matrix, hashes, excluded tooling attempts, and provenance: [native evidence](https://github.com/DiegoZG/PrimeRep-AI/blob/2fc1a85485c163401d912950c208816c549cad83/docs/pr-screenshots/shared-search/README.md).

Both fictional fixtures were restored to the usual 8081 empty first-name screen, Light/large text, without a keyboard. The owned temporary server stopped normally; port 8083 is free and the protected usual services are unchanged.

## Limits and rollout

Explore native smoke remains unverified: its public guest attempt was blocked by the existing authenticated tabs guard. Explore has source/mocked caller and shared web regression coverage only; no auth/guard bypass was attempted. Visible native caret and query erase were checked, but cursor repositioning/full selection range, physical VoiceOver, and release behavior are not certified. No login, account, Health, permission, equipment toggle, or backend/DB action was exercised.

Built on merged main `b9e623552cd6f5a7b6278dbeaf4943f3f8176e87`, after the Equipment Search/See-all PRs merged. No new public props are required. Published-head/current-main integration is reported separately before review readiness; local verification is not a CI/release claim.

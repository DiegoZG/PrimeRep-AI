# U15 Signup UI refinement

Signup previously used decorative field icons and bright focus styling, while its fixed form placed consent and account actions beyond the viewport at maximum accessibility text. The screen now follows the accepted Login presentation: visible field labels, neutral controls, and a keyboard-aware scrolling form with naturally growing text.

## Changes

- Opt Signup into the existing `AnimatedInput` auth presentation. Email and Password labels remain visible; the input component and all its other callers are unchanged.
- Keep the existing title, subtitle, legal phrase, and legal-version capture. Terms and Privacy remain independent links that never toggle the checkbox.
- Retain the checkbox's existing 44×44 target, remove its negative vertical margins, and give its 20-point visual box a neutral checked state. Legal and Log in links are underlined, have 44-point minimum targets, and show a pressed state.
- Center the password eye in a scalable 52-point rail. Use the accepted Login keyboard avoidance, first-tap controls, drag dismissal, and background dismissal pattern.
- Use uncapped `WorkoutText` for natural native text metrics, allow legal content and footer wrapping, and keep purple on the primary Sign up action. Pending submission retains full spinner contrast.

The complete Signup state/controller block is byte-identical to merged main `42b3b5270769bfce446f1fe566932dc71a43f4ff`. Required-field, email, password-length, and consent validation; trimmed email and original password; onboarding snapshot and name fallbacks; legal versions; success-only onboarding reset; root routing; draft retention; and error/retry behavior are preserved. Inputs and every form action remain disabled during submission.

## Verification

- Focused Signup harness: 22/22 passing, including all 12 baseline checks established before presentation changes. The harness loads the actual Signup, AnimatedInput, AnimatedButton, and text components with mocked auth/onboarding services and native hosts.
- Combined regressions: 418/418 distinct tests passing (396 existing plus 22 Signup checks). The UI-action audit self-test runs separately and passes.
- Lint, typecheck, UI-action audit, and diff checks pass. HTTPS-configured web export succeeds for 62 routes.
- Independent verification repeats the 418-test suite and all automated gates, including a fresh 62-route HTTPS web export. Independent source review reports no remaining findings.
- The two historical Login scope guards were narrowed only to permit approved Signup presentation: Signup's controller/state remain byte-identical, and neutral-input callers are limited to Login, Signup, and the unchanged shared input. New Signup scope guards preserve merged Login and 14 shared/auth/config dependencies byte-for-byte. The inherited default-input historical tree checks remain intact.

## Native evidence and limits

Four genuine originals were captured and approved before source changes: Light idle, Dark idle, focused keyboard, and Light maximum text. The maximum-text baseline places consent and primary action beyond the fixed form's reachable viewport. It is not a claim about title overlap or a previously undersized checkbox.

Twelve approved, unchanged originals provide four before and eight after screenshots. After evidence covers normal iPhone 16 Plus Light and Dark, compact Light and Dark, compact Dark focused-password input with the native keyboard, and compact maximum-text Light top/lower plus Dark lower views. The focused-password original shows eight bullets for a synthetic password. Dark local empty-form and invalid-email feedback were checked, but the redacted Maestro invalid-email image is excluded from publication.

All six required native matrix runs exit successfully: full iPhone 16 Plus Light and Dark, full compact Light and Dark, and compact maximum-text layout runs in Light and Dark. Native checks exercise local validation, independent legal/Login links, consent state, password visibility, keyboard interaction, and scrolling. Service-mocked tests establish account payloads and pending/success/failure/reset outcomes; no native account creation is performed.

At native AXXXL in the compact 375-point viewport, uncapped title text wraps according to native metrics. Native layout checks reach all controls, including the checkbox and Terms link. Maximum-text lower screenshots show the Privacy link, Sign up, and Log in at later positions in a continuous scroll. These are reachability views, not a claim that all fields fit simultaneously or that native word wrapping was changed. Both isolated guest simulators are restored to empty Signup, Light theme, normal Large text, unchecked consent, hidden password, and a closed keyboard.

No native signup request or new account is used; payload, pending, reset, rejection, and retry transitions are exercised through service-mocked tests. Simulator evidence does not establish physical-device keyboard behavior, native autofill, Android interaction, VoiceOver traversal, or successful account creation. No CI result is claimed. Those limits must remain explicit in the final PR.

## Scope and rollout

The only production source change is `app/signup.tsx`. Tests, the Signup Maestro flow and README, this document, and approved unchanged screenshot originals provide the review evidence. There are no shared component, theme, navigation, provider, API, storage, legal constant, dependency, native configuration, or backend changes, and no new fonts or shared typography tokens. No migration or special rollout is required. This is a separate screen PR; the next screen waits for Diego's review and merge approval.

## Screenshot review

Normal iPhone 16 Plus after, Light:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-light.png" width="320" alt="Signup after, Light theme, normal text on iPhone 16 Plus" />

Normal iPhone 16 Plus after, Dark:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-dark.png" width="320" alt="Signup after, Dark theme, normal text on iPhone 16 Plus" />

<details>
<summary>Before: original form, keyboard, and maximum text</summary>

Before, Light normal text:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-before-light.png" width="320" alt="Signup before, Light theme, normal text" />

Before, Dark normal text:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-before-dark.png" width="320" alt="Signup before, Dark theme, normal text" />

Before, focused keyboard:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-before-focus-keyboard.png" width="320" alt="Signup before, focused field and keyboard" />

Before, Light maximum text; consent and primary action are beyond the fixed form's reachable viewport:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-before-max-light.png" width="320" alt="Signup before, Light maximum text with lower actions beyond the fixed viewport" />

</details>

<details>
<summary>After: compact screens, focused keyboard, and maximum text</summary>

After, compact Light:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-compact-light.png" width="320" alt="Signup after, compact Light screen at normal text" />

After, compact Dark:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-compact-dark.png" width="320" alt="Signup after, compact Dark screen at normal text" />

After, compact Dark focused-password input; eight bullets represent a synthetic password, and the native keyboard is visible:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-compact-dark-focus.png" width="320" alt="Signup after, compact Dark focused password showing eight synthetic-password bullets and native keyboard" />

After, compact 375-point Light at native AXXXL, top position; uncapped title text wraps naturally:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-compact-max-light-top.png" width="320" alt="Signup after, compact 375-point Light native AXXXL top view with naturally wrapping title" />

After, compact 375-point Light at native AXXXL, later scroll position showing reachable lower controls:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-compact-max-light-lower.png" width="320" alt="Signup after, compact 375-point Light native AXXXL lower controls reached by continuous scrolling" />

After, compact 375-point Dark at native AXXXL, later scroll position showing reachable lower controls:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/696473e455bbc700570d64690388dfcd9eb84161/docs/pr-screenshots/u15/u15-after-compact-max-dark-lower.png" width="320" alt="Signup after, compact 375-point Dark native AXXXL lower controls reached by continuous scrolling" />

</details>

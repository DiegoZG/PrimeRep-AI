# U17 First Reason UI refinement

First Reason previously used bright cyan selection borders, low-contrast descriptions, fixed text metrics, and an absolute NEXT footer. The screen now uses compact neutral option cards with an explicit selected radio state, readable descriptions, and a Continue action in the same scroll flow as all five choices. Continue is neutral while disabled and purple once a choice is selected.

## Changes and preserved contracts

- Keep the exact five option IDs, titles, descriptions, and order from `REASON_SCREEN`. Selection uses a stable neutral border and a small geometric check; the decorative check is hidden from accessibility. Each option exposes `accessibilityRole="radio"`, an exact title/description label, and `accessibilityState.checked`.
- Retain the existing neutral theme and system font. The question uses 28/600, option titles 16/600, and descriptions 14/400. Natural text wrapping has no fixed line height, line cap, font shrinking, or font-scale cap.
- Keep all choices and Continue inside one growing ScrollView with automatic inset adjustment. Cards have a 44-point minimum height and Continue has a 56-point minimum height; the footer participates in layout instead of overlapping lower cards.
- Give the actual shared AnimatedButton a neutral disabled surface and readable text, then purple paint and white text when enabled. Its centered label stretches to the available width and neither the label nor the button shrinks, allowing natural growth at maximum accessibility text. Preserve the disabled state and the existing guarded handler.

The entire 4,314-byte First Reason controller before its return remains byte-identical to merged main `e68e9de49bca3965e4c6d0b0e26cb9c6ed1fda1e`. Local selection, `updateField("reason", option.id)`, restored choice handling, the exact `/onboarding/body-stats` route, repeated navigation actions, screen transitions, and entrance timing remain unchanged. The shared AnimatedButton, onboarding provider, theme, font tokens, and hooks remain unchanged. Motion configurations retain Reanimated's system-default reduced-motion behavior.

## Verification

- Before production edits, `node --test scripts/test-*.mjs` passed 445 existing cases: 444 regressions plus the UI-action audit self-test. The new unchanged-screen baseline passed 34 cases before the design gate.
- The finished U17 harness passes 44/44: 16 historical rendered behavior cases, 16 current rendered behavior cases, one exact controller/content guard, one real motion/shared-button test, and ten presentation checks. Historical and current cases intentionally exercise the same behavior in both themes.
- The harness loads the real screen, OnboardingProvider, AnimatedButton, ThemedView, theme/font constants, and transition hook. Only native rendering/animation, router, authentication context, and storage boundaries are mocked. It verifies all five choices, exact reason writes and persisted payloads, preserved unrelated onboarding fields, restored selection, replacement selection, disabled-handler navigation guards, repeated Continue presses, radio semantics, exclusive check visibility, enabled/disabled action contrast, natural text properties, and scroll containment.
- Focused U17 and Welcome checks pass 70/70. The full suite passes 489/489, including all 445 existing cases and 44 U17 cases. `npm run lint`, `npm run audit:ui-actions`, targeted ESLint, and `git diff --check` pass.
- Independent final-source verification repeats the 70 focused and 489 full-suite cases and passes lint, typecheck, interaction audit, audit self-test, and diff checks. A fresh cache-cleared web export with HTTPS configuration succeeds for 62 routes and verifies the embedded final-source presentation. Independent review approves the frozen source and native evidence with no remaining findings.
- Font-scale cases in the JavaScript harness verify uncapped text and growing layout properties; they do not simulate native glyph layout. Native evidence is recorded separately below. Independent typecheck verification passes.

## Historical guard migration and independence

The Welcome test suite previously froze the entire First Reason file and asserted that every production path still matched its historical PR scope. That historical all-app diff assertion would reject independent, authorized presentation work on later screens. A shared test-only prerequisite commit replaces the First Reason full-file freeze with its exact pre-return controller/motion guard and removes only that global historical scope assertion. All 26 Welcome tests and every other named auth, onboarding, provider, component, hook, theme, service, legal, asset, and package dependency contract remain intact.

The same test-only prerequisite is reused identically across the independent U17, U18, and U19 branches. It does not introduce a production UI dependency between their PRs. U17's new harness guards only its own controller and reason content and does not freeze unrelated future screens or global Git diffs.

## Native evidence and limits

Genuine unchanged before captures were completed and reviewed before the production source gate. Initial native maximum-text testing exposed a clipped Continue label even though the action used a minimum height. A local full-width, nonshrinking label lets the action measure and grow naturally without a font cap or controller change. Both final maximum-text originals show the complete readable label and padding. Failed intermediate screenshots are excluded from published assets.

Five native configurations pass: two normal Light/Dark full flows on iPhone 16 Plus, two Light/Dark maximum-text layout checks on that device, and one compact iPhone SE Light read-only check of the empty/disabled state. The normal flows verify Beginner selection, replacement selection with the previous choice unchecked, the last choice, enabled Continue, exact Body Stats navigation, and retained selection after returning. Maximum-text checks verify actual card activation, native checked state, scrolling, and the entire readable action; navigation at maximum text is not claimed. The compact guest check does not select an option and returns to empty Signup.

Normal and compact checks used predecessor source `589a9e3413a1b08da3070f0c1aa94ca72dee32588cf362417457d7e058475a43`, before the final local label-width adjustment. Both maximum-text checks were rerun on final frozen source `945ce786db3b932c0a278fd655720d0d25d85d027b5e32674baab8ea2d8fc653`. The fictional 16 Plus fixture returned to Light and standard text with its structured-plan choice retained; the original compact guest returned to empty Signup. Reduce Motion was not changed. Ten approved unchanged originals are included below with immutable `6bfbce015d6f28967d407fdd94f395935ec3adb5` URLs pinned to the reviewed asset commit; provenance and reproduction steps are in `docs/pr-screenshots/u17/README.md`.

The existing shared onboarding header still has a cyan Skip action and pre-existing maximum-accessibility-text clipping limitations. Those shared-header issues remain outside U17's production scope. Simulator screenshots and native flows do not establish Android behavior, physical-device behavior, VoiceOver traversal, or native animation frame timing. The harness proves preserved motion configuration; a native OS Reduce Motion run is not claimed.

## Scope and rollout

Only `app/onboarding/first-reason.tsx` changes production source. Supporting files are the U17 harness, precise historical Welcome guard migration, `.maestro/first-reason-refinement.yaml`, the unique `docs/pr-screenshots/u17/README.md`, this narrative, and approved screenshot originals. No shared-header, navigation, API, storage, provider, legal, dependency, native-configuration, or backend implementation changes are included. No migration or special rollout is required. The user's untracked `DESIGN-IS-2026-10-11/` directory and local app-wide roadmap remain excluded. This independent PR awaits review and is not automatically merged.

## Screenshot review

Normal Light and Dark selected-state captures precede the final local label-width adjustment:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-light-selected.png" width="320" alt="First Reason after, normal Light with Beginner checked and neutral cards" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-dark-selected.png" width="320" alt="First Reason after, normal Dark with Beginner checked and neutral cards" />

<details>
<summary>Before: empty choice state and cyan selected borders</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-before-light-initial.png" width="320" alt="First Reason before, Light with no selection" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-before-light-selected.png" width="320" alt="First Reason before, Light Beginner selection with cyan border" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-before-dark-selected.png" width="320" alt="First Reason before, Dark Beginner selection with cyan border" />

</details>

<details>
<summary>After: enabled and disabled actions, and final maximum-text growth</summary>

Normal Light and Dark bottom captures and the compact disabled-state capture precede the final local label-width adjustment:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-light-bottom.png" width="320" alt="First Reason after, normal Light with the last choice checked and enabled Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-dark-bottom.png" width="320" alt="First Reason after, normal Dark with the last choice checked and enabled Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-compact-light-disabled.png" width="320" alt="First Reason after, compact Light with no checked choice and neutral disabled Continue" />

Final-source maximum-text Light and Dark lower views, reached through continuous scrolling; the action grows naturally and its complete label remains readable:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-light-max-bottom.png" width="320" alt="Final First Reason, maximum-text Light with the complete Continue label and natural button height" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/6bfbce015d6f28967d407fdd94f395935ec3adb5/docs/pr-screenshots/u17/u17-after-dark-max-bottom.png" width="320" alt="Final First Reason, maximum-text Dark with the complete Continue label and natural button height" />

</details>

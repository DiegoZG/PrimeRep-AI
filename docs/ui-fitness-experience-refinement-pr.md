# U18 Fitness Experience UI refinement

Fitness Experience previously repeated the primary color across a selected-card wash, border, filled checkbox, and NEXT action. Its helper and descriptions also used the placeholder color, while the action sat outside the scroll flow. The screen now uses readable neutral text and unfilled selection cards, an explicit selected radio state, and an in-flow Continue action that is neutral when disabled and purple when enabled.

## Changes and preserved contracts

- Retain the exact question, helper, four option IDs, titles, descriptions, and order from `FITNESS_EXPERIENCE_SCREEN`.
- Use stable one-point neutral card borders, with the selected border using theme text color. Each option exposes `accessibilityRole="radio"`, its exact title/description label, and `accessibilityState.checked`.
- Preserve the real shared AnimatedCheckmark component and animation unchanged. A local twenty-point decorative slot is hidden from accessibility; its small neutral geometric check avoids a scaling text glyph and filled checkbox.
- Use the existing system font and neutral theme: question 28/600, helper 15/400, titles 16/600, and descriptions 14/400. Helper and descriptions use the readable theme icon color. Text wraps naturally without fixed line heights, line caps, font shrinking, or font-scale caps.
- Keep the question, helper, four cards, and Continue in one growing ScrollView with automatic inset adjustment. Cards have a 44-point minimum height and the actual AnimatedButton has a 56-point minimum height. Its full-width centered label and nonshrinking layout support natural growth at maximum accessibility text.

The complete 4,531-byte Fitness Experience controller before its return, including context access, local restored selection, exact `updateField("experienceLevel", option.id)` writes, conditional navigation, screen transition, question/helper entrance timing, and option timing, remains byte-identical to merged main `e68e9de49bca3965e4c6d0b0e26cb9c6ed1fda1e`. No Experience and Beginner continue to `/onboarding/fitness-goal`; Intermediate and Advanced continue to `/onboarding/fitness-experience/one-rep-max`. The disabled guard and repeated press behavior remain unchanged. Shared providers, components, fonts, theme, and animation hooks remain unchanged, including system-default Reanimated reduced-motion configurations.

## Verification

- Before production edits, all 445 existing tests passed: 444 regressions and the UI-action audit self-test. The new unchanged-screen baseline passed 25 meaningful cases.
- The finished U18 harness passes 37/37: those same 25 controller/content, behavior, and motion cases plus twelve presentation checks. It does not duplicate every behavior with a historical render. Both themes cover the original content/order, all four selection payloads and routes, all four restored choices, replacement selection, preservation of unrelated onboarding fields and stored payloads, empty-state navigation guards, repeated presses, and real checkmark/button motion.
- The harness loads the actual Fitness Experience screen, OnboardingProvider, AnimatedButton, AnimatedCheckmark, ThemedView, theme/font constants, and transition hook. Only native rendering/animation, router, authentication context, and storage boundaries are mocked.
- Presentation checks verify exclusive radio states, stable neutral borders and surfaces, decorative check accessibility and real animated visibility, helper/title/description contrast, neutral disabled and purple enabled action states, press feedback, target minimums, full-width nonshrinking action text, and one inset-aware scroll flow. Font-scale cases verify structural text and layout properties; they do not simulate native glyph layout.
- Focused U18 and unchanged Welcome checks pass 63/63. The full suite passes 482/482, including all 445 existing cases and 37 U18 cases. `npm run lint`, `npm run audit:ui-actions`, and `git diff --check` pass.

- Independent final-source verification repeats all 63 focused and 482 full-suite cases and passes typecheck, lint, interaction audit, audit self-test, and diff checks. A fresh cache-cleared web export with dotenv disabled produces 62 actual HTML files, and its emitted JavaScript contains the expected HTTPS API URL `https://api.primerep.invalid`. Independent review confirms exact controller and shared-component bytes with no remaining findings.

## Independence and scope

This branch starts from the same merged main plus shared test-only guard commit `ef6c5e3a32a86ebea364ea864ad93ab4a524afd7`. That common commit narrows the historical Welcome First Reason guard to its exact controller and removes only Welcome's historical all-app diff assertion; all 26 Welcome tests and other named dependency guards remain intact. U18 does not change that shared commit, carry U17 production work, or depend on U17's UI, tests, assets, or documentation. Its own harness guards only the Experience controller and content, with no global Git-diff assertion or freeze of unrelated future screens.

Only `app/onboarding/fitness-experience/index.tsx` changes production source. Supporting files are the U18 harness, `.maestro/fitness-experience-refinement.yaml`, the unique `docs/pr-screenshots/u18/README.md`, this narrative, and approved original screenshots. Shared headers, navigation, providers, APIs, storage implementation, legal content, dependencies, native configuration, other onboarding screens, and backend source remain outside the change. No migration or special rollout is required. The user's untracked `DESIGN-IS-2026-10-11/` directory and local app-wide roadmap remain excluded. This independent PR awaits review and is not automatically merged.

## Native evidence and limits

Genuine unchanged before originals were captured before production edits and reviewed at the design gate. Five native configurations pass on frozen source SHA-256 `84d594492fd62abc5fea70354fce2bb7f4d43c3fe23e89a23d4bd6c904eac1fd`: normal Light and Dark full flows on iPhone 16 Plus, maximum-text Light and Dark layout checks on that device, and a compact iPhone SE Light read-only empty/disabled-state check.

The normal Light flow verifies No Experience to Fitness Goal and Intermediate to One Rep Max; the normal Dark flow verifies Beginner to Fitness Goal and Advanced to One Rep Max. Each return retains its selected experience. Maximum-text checks activate a starter option and replace it with Advanced, verify native radio states, and reach the entire readable Continue control with natural growth and padding. Navigation at maximum text is not claimed. The compact guest does not select an option and returns to empty Signup.

The fictional 16 Plus fixture returns to Light and standard text, retaining its Advanced experience, structured-plan reason, and existing bench value of 100. Ten approved unchanged originals are embedded below; provenance and reproduction instructions are in `docs/pr-screenshots/u18/README.md`.

The shared cyan Skip action and pre-existing maximum-accessibility-text header limitations remain outside this screen's scope. Automated motion checks preserve configuration; native screenshots do not establish animation frame timing, Android behavior, physical-device behavior, or VoiceOver audio traversal. No native OS Reduce Motion result is claimed.

## Screenshot review

Normal Light and Dark selected-state originals:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-light-selected.png" width="320" alt="Fitness Experience after, normal Light with an explicit neutral selected radio state" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-dark-selected.png" width="320" alt="Fitness Experience after, normal Dark with an explicit neutral selected radio state" />

<details>
<summary>Before: empty choice state and repeated purple selection treatments</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-before-light-initial.png" width="320" alt="Fitness Experience before, normal Light with no selected option" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-before-light-selected.png" width="320" alt="Fitness Experience before, Light selected card with purple wash, border and checkbox" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-before-dark-selected.png" width="320" alt="Fitness Experience before, Dark selected card with purple wash, border and checkbox" />

</details>

<details>
<summary>After: primary action, compact disabled state and maximum-text growth</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-light-bottom.png" width="320" alt="Fitness Experience after, normal Light with selected experience and purple Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-dark-bottom.png" width="320" alt="Fitness Experience after, normal Dark with selected experience and purple Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-compact-light-disabled.png" width="320" alt="Fitness Experience after, compact Light with no checked choice and neutral disabled Continue" />

Maximum-text Light and Dark lower views reached through continuous scrolling; the complete Continue label grows naturally:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-light-max-bottom.png" width="320" alt="Fitness Experience after, maximum-text Light with complete readable Continue label and natural button height" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/dadc02bca70ba10873ca8b28a129a8bfe688f108/docs/pr-screenshots/u18/u18-after-dark-max-bottom.png" width="320" alt="Fitness Experience after, maximum-text Dark with complete readable Continue label and natural button height" />

</details>

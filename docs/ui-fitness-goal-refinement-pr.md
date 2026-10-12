# U20 Fitness Goal UI refinement

Fitness Goal previously used purple for selected cards, checkmarks, and the Popular tag as well as NEXT. Selection now uses a neutral border and checkmark, tags sit naturally within their cards, and the enabled Continue button owns the purple emphasis. The actual button scrolls with the choices so enlarged text can grow without a fixed footer covering the last option.

## Changes and preserved contracts

- Keep all four choice IDs, order, titles, descriptions, and exact `Popular` / `Powerlifting` tag text. Use existing system fonts, a 28-point/600 heading, readable `colors.icon` helper text, and uncapped natural text metrics.
- Give every card a stable two-point border; the selected card uses readable gray and a neutral checkmark without a purple fill. Tags use neutral paint and remain in the content flow.
- Expose each choice as one radio with an explicit checked state and an accessible label containing its exact title, description, and tag when present. Hide the existing animated checkmark as decoration while preserving its animation.
- Put the actual full-width Continue button, with a 56-point minimum height and naturally growing centered label, in the same inset-aware ScrollView as the question and choices. Empty selection keeps it disabled and neutral; valid selection enables its existing purple action.

The entire 4,123-byte controller before its return remains byte-identical to base `9f2811810329482b6871f11558f3e23c1bc1e65b`. The `FITNESS_GOAL_SCREEN` object is unchanged. Local restored selection, real context writes, persistence, replacement and repeated selections, conditional `/onboarding/training-frequency` navigation, direct-handler gating, screen transitions, entrance timing, checkmark animation, and button press feedback retain their existing behavior.

Only `app/onboarding/fitness-goal.tsx` changes in production. Shared components, providers, headers, hooks, theme, constants, authentication, storage, API, database, native configuration, dependencies, and legal content remain unchanged.

## Verification

- Before the presentation changes, the new unchanged-screen harness passed 15 meaningful behavior/controller/motion cases. The final harness passes those same cases plus eight distinct presentation checks: 23/23, without duplicating baseline cases under historical renders.
- The harness loads the actual Fitness Goal screen, OnboardingProvider, AnimatedButton, AnimatedCheckmark, ThemedView, transition and theme hooks, and theme/font constants. Native rendering and animation, routing, authentication context, and storage boundaries are mocked. Both themes cover all four choice writes and persistence, restored selections, empty/direct navigation guards, replacement and repeated taps, external context updates with local selection gating, and existing motion configurations.
- Presentation checks cover exclusive radio/check semantics, exact accessible labels, stable neutral borders, readable helper/description/tag contrast, enabled-only purple paint, preserved press feedback, and natural scroll containment at normal and large text. Structural font-scale tests do not claim native glyph measurements.
- Independent verification of frozen screen SHA256 `68897c2c6e4d12146d928151090dbd291eb5e5674a1b9cfb3b9d663c6072e26d` passes 232 focused cases and all 593 full-suite cases, including the interaction-audit self-test. Lint, typecheck, interaction audit, audit self-test, and diff checks pass.
- A fresh cache-cleared web export with `EXPO_NO_DOTENV=1` produces 62 actual HTML files. The emitted `entry-24351e23a27eafacbadbf33c42dccf48.js` contains the Goal presentation selectors and the temporary verification API URL `https://api.primerep.invalid`. Independent logs are preserved at `/private/tmp/u20-independent-review.FXpCuC`.

## Native evidence and limits

Five native configurations pass on the final frozen source: normal Light and Dark, cold maximum-text Light and Dark, and a compact Light read-only empty-state run. The normal flows collectively exercise all four actual choices, selection replacement, Continue to Training Frequency, return to Fitness Goal, and the complete bottom Continue frame with safe-area clearance. Both cold maximum-text runs reach actual question/helper, option title/description, and tag glyphs through scrolling and overlapping private captures, then show the complete Continue frame above the safe area. These are native layout checks; they do not claim another complete maximum-text routing run. The compact guest shows four unchecked choices and disabled neutral Continue, then returns to the original empty Signup without edits.

The screenshot set contains exactly three genuine original BEFORE images and seven final-source AFTER images. Every published AFTER capture uses final screen SHA256 `68897c2c6e4d12146d928151090dbd291eb5e5674a1b9cfb3b9d663c6072e26d`; all ten published raw copies match their simulator originals byte for byte. The two visible comparison images below deliberately show different selected goals: BEFORE selects “Build muscle and get toned”; AFTER selects “Get stronger.” Bottom screenshots separately show the complete action after scrolling. The screenshot README records provenance and configuration coverage.

The shared cyan Skip header and its maximum-text limitations remain outside this screen refinement. Native evidence does not claim a physical-device or Android run, VoiceOver audio, OS Reduce Motion execution, or native frame timing. Harness motion cases verify preserved structure and configurations.

## Independence, dependencies, and rollout

This independent branch starts at `9f2811810329482b6871f11558f3e23c1bc1e65b`. Its harness guards only its own controller and content, with no global Git-diff assertion or freeze of unrelated planned screens. The sibling Body Stats branch starts at the same base and has no dependency on this Goal implementation, harness, screenshots, or documentation.

No API changes, database migrations, dependency updates, or special rollout are required. The user's untracked design directory and local roadmap remain excluded. This PR awaits photo and code review; it is not automatically merged.

## Screenshot review

Before, normal Dark with “Build muscle and get toned” selected:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-before-dark-selected.png" width="320" alt="Original Fitness Goal in Dark with Build muscle selected, purple card and uppercase Popular tag" />

After, normal Dark with a different goal, “Get stronger,” selected; the complete Continue frame appears in the bottom detail below:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-dark-selected.png" width="320" alt="Final Fitness Goal in Dark with Get stronger selected through a neutral border and checkmark" />

<details>
<summary>Original Light and Dark empty states</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-before-light-initial.png" width="320" alt="Original Fitness Goal in Light before a goal is selected" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-before-dark-initial.png" width="320" alt="Original Fitness Goal in Dark before a goal is selected" />

</details>

<details>
<summary>Final normal Light selection and complete Light/Dark Continue frames</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-light-selected.png" width="320" alt="Final Fitness Goal in Light with neutral selected-card treatment" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-light-bottom.png" width="320" alt="Final Fitness Goal in Light scrolled to the complete enabled Continue button" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-dark-bottom.png" width="320" alt="Final Fitness Goal in Dark scrolled to the complete enabled Continue button" />

</details>

<details>
<summary>Final cold maximum-text Light/Dark and compact Light empty state</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-light-max-bottom.png" width="320" alt="Final Fitness Goal at cold maximum text in Light with the bottom action in view" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-dark-max-bottom.png" width="320" alt="Final Fitness Goal at cold maximum text in Dark with the bottom action in view" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/u20-after-compact-light-disabled.png" width="320" alt="Final Fitness Goal on compact Light with no selected goal and disabled neutral Continue" />

</details>

[Screenshot provenance and native configurations](https://github.com/DiegoZG/PrimeRep-AI/blob/U20_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u20/README.md)

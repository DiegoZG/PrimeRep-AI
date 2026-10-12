# U16 Welcome UI refinement

Welcome previously used a cyan logo halo and cyan personalized name. Its fixed content also clipped the greeting and hid the name at maximum accessibility text on a compact iPhone. The screen now uses a neutral logo and personalized name, a quieter greeting, and a naturally growing scroll surface with a purple Continue action.

## Changes and preserved contracts

- Reuse the existing Logo with its existing color prop, neutral theme text, and natural 144×176 proportions. Remove the halo; no logo asset or shared component changes.
- Retain the exact “Welcome to PrimeRep AI,” greeting and personalized name with its existing `there` fallback. Preserve whitespace without introducing name trimming. Use the existing system font at 28/600 for the greeting and 32/600 for the name.
- Rename the primary presentation from NEXT to Continue, as specified by the U16 plan. Give it an explicit accessible button name and a 56-point minimum height with natural text growth.
- Place greeting, name and action in one vertical ScrollView with automatic inset adjustment and growing content. Text remains uncapped and can wrap without fixed line height, truncation, or font shrinking.

The entire Welcome controller, including context access, name derivation, exact `/onboarding/first-reason` navigation, screen transition, and entrance timing, remains byte-identical to merged main `0c392524c88f3add3239b80ecb117cccc342f923`. The actual AnimatedCard, AnimatedButton and transition hook are unchanged. Their existing Reanimated timing, delay and spring configurations retain system-default reduced-motion behavior; no animation forces `ReduceMotion.Never`.

## Verification

- Before production changes, all 418 existing distinct regressions passed and a new 17-case Welcome baseline passed against the actual unchanged screen.
- Focused Welcome checks pass 26/26: the 17 baseline cases plus nine presentation checks. The harness loads the actual screen, Logo, AnimatedCard, AnimatedButton, transition and theme components with native, router, context and animation boundaries mocked. It exercises names/fallbacks/whitespace, immutable onboarding data, live context updates, repeated route actions, press feedback, neutral colors/contrast, scroll containment, target size and uncapped text.
- Combined regressions pass 444/444 distinct tests across 28 files: 418 existing plus 26 Welcome cases. The UI-action audit self-test runs separately and passes, along with the interaction audit, lint, typecheck and diff checks.
- Byte guards preserve the complete Welcome controller and merged Login/Signup, shared providers/components/theme/hooks/services, onboarding routes, package/dependency/legal files, assets and other production source. No historical test guard needed migration.
- Independent verification repeats all 444 tests and automated gates. A fresh cache-cleared HTTPS-configured web export succeeds for 62 routes. Independent source review reports no remaining findings.

## Native evidence and limits

Four genuine unchanged before originals were captured and reviewed before the source gate: iPhone 16 Plus Light and Dark at normal text, compact iPhone SE Light at normal text, and compact Light maximum accessibility text. The maximum-text baseline shows greeting clipping, lower text hidden behind NEXT, and an unreachable personalized name. These images are copied unchanged into `docs/pr-screenshots/u16/`.

Eleven required native matrix runs pass: six normal-text full flows (iPhone 16 Plus and compact guest Light/Dark, plus the long-name fixture Light/Dark), four maximum-text layout flows (compact guest and long-name fixture Light/Dark), and one full long-name flow with the OS Reduce Motion switch verified on through public Settings. The six normal-text full flows and the Reduce Motion full flow verify navigation to the existing Reason screen; the four maximum-text runs verify scroll reachability and layout only. The OS setting is verified off again afterward; this establishes content and navigation usability, not animation timing or frame behavior.

Twelve approved unchanged originals provide four before and eight after screenshots. After evidence covers normal iPhone 16 Plus Light/Dark, compact Light/Dark, compact maximum-text Light/Dark lower views, a normal Dark synthetic long name, and a maximum-text Light long-name lower view. The maximum-text frames are later positions in continuous scrolling, with native word wrapping and the reachable Continue action; they do not show every line simultaneously.

Both original guest simulators return to empty Signup, Light theme, normal Large text, unchecked consent, hidden password and closed keyboard. Their preferred-name context was never written. A newly created disposable simulator holds only its own fictional “Alexandria-Lee Montgomery” fixture and remains at Welcome in Light, normal Large text, with Reduce Motion off. The existing name screen prevents an empty-name Next action, so the fixture is not described as having an empty restored context. No API account or database operation is involved.

The shared onboarding header still has a cyan Skip action, and its text clips at maximum accessibility size. That existing header is outside this screen's production scope and has a dedicated follow-up in the local roadmap; neither issue is fixed in U16. Native simulator evidence does not establish Android, physical-device behavior, VoiceOver traversal, or native animation frame/timing behavior. The animation harness verifies configuration preservation, while the public OS reduced-motion check establishes content and navigation usability. GitHub CI results are not claimed.

## Scope and rollout

Only `app/onboarding/welcome.tsx` changes production source. Supporting tests, the Welcome Maestro flow and README, this document and approved screenshot originals provide review evidence. No shared header, navigation, provider, API, storage, legal constant, dependency, native configuration or backend change is included. No migration or special rollout is required. The local roadmap and `DESIGN-IS-2026-10-11/` remain untracked and excluded. This is a separate screen PR, with later slices awaiting Diego's review and merge.

## API references

Native scrolling/insets and natural text follow the existing component patterns and [React Native ScrollView](https://reactnative.dev/docs/scrollview) and [Text](https://reactnative.dev/docs/text) documentation. The preserved motion configurations follow [Reanimated accessibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/), also checked against the installed Reanimated implementation.

## Screenshot review

Normal iPhone 16 Plus after, Light:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-light.png" width="320" alt="Welcome after, Light theme at normal text on iPhone 16 Plus" />

Normal iPhone 16 Plus after, Dark:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-dark.png" width="320" alt="Welcome after, Dark theme at normal text on iPhone 16 Plus" />

<details>
<summary>Before: original glow, personalized name, and maximum text</summary>

Before, Light normal text:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-before-light.png" width="320" alt="Welcome before, Light theme, cyan logo halo and name" />

Before, Dark normal text:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-before-dark.png" width="320" alt="Welcome before, Dark theme, cyan logo halo and name" />

Before, compact Light:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-before-compact-light.png" width="320" alt="Welcome before, compact Light screen at normal text" />

Before, compact Light maximum text; greeting clips and NEXT overlaps lower text:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-before-max-light.png" width="320" alt="Welcome before, compact maximum text with greeting clipping and NEXT overlapping text" />

</details>

<details>
<summary>After: compact screens and maximum-text scroll reachability</summary>

After, compact Light:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-compact-light.png" width="320" alt="Welcome after, compact Light screen at normal text" />

After, compact Dark:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-compact-dark.png" width="320" alt="Welcome after, compact Dark screen at normal text" />

After, compact maximum-text Light lower view, reached through continuous scrolling:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-max-light-lower.png" width="320" alt="Welcome after, compact maximum-text Light personalized name and Continue reached by scrolling" />

After, compact maximum-text Dark lower view, reached through continuous scrolling:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-max-dark-lower.png" width="320" alt="Welcome after, compact maximum-text Dark personalized name and Continue reached by scrolling" />

After, normal-text Dark fictional long name on the separate disposable iPhone 16 Plus:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-long-name-dark.png" width="320" alt="Welcome after, Dark normal text with fictional Alexandria-Lee Montgomery name wrapping naturally" />

After, maximum-text Light fictional long-name lower view; native word wrapping and Continue at a later scroll position:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U16_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u16/u16-after-long-name-max-light-lower.png" width="320" alt="Welcome after, maximum-text Light lower portion of fictional long name and Continue reached by scrolling" />

</details>

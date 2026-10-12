# U21 Body Stats UI refinement

Body Stats previously used cyan for gender selection, units, and input focus, while disabled NEXT still carried purple emphasis. The form now uses readable neutral controls and reserves purple for enabled Continue. Its content-only keyboard-dismiss wrapper exposes individual form controls, and the actual Continue remains within the existing keyboard-avoiding layout.

## Changes and preserved contracts

- Keep the existing heading and system font, using 26-point/600 heading text and natural, uncapped labels. Replace only the body helper with the factual sentence “We use gender, weight and age to personalise your workouts.” Helper text uses readable `colors.icon`.
- Keep the same gender dropdown, four options, ordering, and selection handler. Add an explicit expanded state, selected/checked option states, neutral borders, a decorative checkmark, and option targets of at least 44 points.
- Present LB/KG as two neutral buttons with explicit selected states and accessible names explaining that units apply to body weight and one-rep maxes. A selected-unit tap does nothing; choosing the other unit invokes the existing toggle once. No conversion handler or shared component changes.
- Stack full-width, individually named numeric inputs with a 56-point minimum height. Reuse the existing AnimatedInput `authPresentation` opt-in for neutral focus without a halo. Preserve the age error messages, invalid state, hint, and polite live announcement; semantic error colors remain readable in both themes.
- Put the `accessible={false}` keyboard-dismiss wrapper around content only, inside a flexing inset-aware ScrollView with handled taps and on-drag dismissal. Continue is its in-flow sibling footer inside the unchanged KeyboardAvoidingView: iOS padding with offset 100, Android height with offset zero. The actual 56-point-minimum Continue grows naturally, is neutral when disabled, and becomes purple when enabled.

The complete 5,830-byte imports/pre-return source, including the 4,761-byte function controller, remains byte-identical to base `9f2811810329482b6871f11558f3e23c1bc1e65b`. This preserves truthy prefill, local state, gender writes and picker closure, strict Number weight validation through 700, integer age validation from 13 through 120, every original error string, direct-handler navigation gating, and the exact `/onboarding/fitness-experience` route. Context synchronization, persistence and payload field names, body-weight plus all three 1RM conversions, one-decimal rounding, screen transitions, card entrances, and input/button motion remain unchanged.

Existing provisional-value behavior remains faithful: strict Number validation and parseFloat unit conversion can treat malformed drafts differently; context synchronization can clear a weight draft when stored weight changes; a small converted weight can round to zero. This presentation change does not introduce a validator or alter those semantics.

Only `app/onboarding/body-stats.tsx` and the single `BODY_STATS_SCREEN.manualSection.description` string change in production. Shared components, providers, hooks, theme, headers, authentication, storage, API, database, Health access, permissions, native configuration, legal content, and dependencies remain unchanged.

## Verification

- Before production edits, the new actual-screen harness passed 29 meaningful baseline behavior/controller/motion cases. The final harness passes those same 29 cases plus 11 distinct presentation checks: 40/40. Historical renders are not duplicated to inflate the count.
- The harness loads the actual screen, OnboardingProvider, AnimatedInput, AnimatedButton, AnimatedCard, conversion utility, theme/font constants, ThemedView, and transition/theme hooks. Native rendering and animation, routing, authentication context, and storage boundaries are mocked. Conversion tracing calls the actual utility rather than reproducing its arithmetic.
- Both themes cover blank defaults, all four gender choices, prefill, truthy initialization, positive/finite weight and inclusive bounds, invalid drafts, exact integer-age bounds and errors, body plus three-maxima conversion and rounding, undefined/nonnumeric maxima, provisional quirks, external weight/unit synchronization, remount, route gating, picker dismissal, and existing motion. An Android boundary case verifies the existing keyboard settings; it is not a native Android run.
- Presentation checks verify factual copy, helper/error contrast, native accessibility states, a neutral selected check, selected-unit no-ops, exactly one toggle dispatch with four real value conversions and five field writes, named full-width inputs, actual neutral focus/blur, enabled-only purple, natural text sizing, and content-only dismissal inside the scroller with its sibling footer.
- Independent verification of final screen SHA256 `33b83e4f48db0311c784b618ac9f9b14bffca0ecb64e8f953aeb8686ff64e8d7` passes 267 focused cases and all 610 full-suite cases, counting the interaction-audit self-test once. Lint without warnings, typecheck, interaction audit, audit self-test, and diff checks pass.
- A fresh cache-cleared web export with `EXPO_NO_DOTENV=1` produces 62 actual HTML files. The emitted `entry-f0100f69a74af3e6062549891a231f7a.js` contains the temporary verification API URL `https://api.primerep.invalid`, Body Stats selectors, and the approved factual copy. Independent logs are preserved at `/private/tmp/u21-independent-review.PoWshD`.

## Historical guards and independence

The Login and Signup caller guards add exactly one approved route, `app/onboarding/body-stats.tsx`, yielding the exact five allowed paths including the shared AnimatedInput implementation. Both retain their existing auth and One Rep Max controller freezes and add the complete unchanged Body Stats pre-return guard against the independent base. No shared input implementation or legacy-input check is relaxed.

The permanent Body Stats content guard protects only its own object and allows only the approved description change. A one-time complete constants-file comparison confirms exactly that one string replacement now, without freezing unrelated future screen content. This independent branch starts at the merged main base `9f2811810329482b6871f11558f3e23c1bc1e65b`, with no stacked dependency on the Fitness Goal implementation, harness, or artifacts from PR #70.

## Native evidence and limits

Five native configurations pass on final frozen screen SHA256 `33b83e4f48db0311c784b618ac9f9b14bffca0ecb64e8f953aeb8686ff64e8d7`: iPhone 16 Plus Light/Dark at large system text, cold maximum-text Light/Dark, and an iPhone SE Light read-only empty-state check. All ten published PNGs are unmodified and byte-identical to their simulator originals: three genuine BEFORE images and seven final-source AFTER images. The BEFORE captures show the original blank gender/weight/age fields, LB, and visible disabled NEXT in Light and Dark. The Dark keyboard capture shows the actual numeric keyboard and original cyan focus on an empty weight input. A successful Light BEFORE keyboard interaction is not claimed.

The two normal flows collectively exercise all four gender choices: Light Male→Female, Dark Other→Prefer not to say. Reopening shows the actual checked choice; selected-unit taps are no-ops; 180 LB→81.6 KG→179.9 LB preserves existing rounding. Age12 shows the existing red error with disabled/no-route Continue, and age30 recovers. Background/drag dismissal preserves the draft. With the real numeric keyboard visible, the entire Continue frame sits above it; one tap reaches Fitness Experience (3/9), and public return retains gender, weight, and age. Native normal gender/Continue targets measure 56 points; unit segments measure 44 points.

Both cold maximum-text runs reach actual heading/helper glyphs through overlapping captures, the whole longest closed gender label, all four expanded options and selected check, LB/KG, full numeric inputs, and the entire grown Continue above the safe area. The whole age12 error and disabled action are reached before age30 recovery. These are layout/error checks, without a maximum-text route or first-tap keyboard claim. The compact guest remains read-only with blank required fields, LB, and disabled Continue, then returns to empty Signup without selection, focus, or typing. Private companion originals document dropdown/error/scroll reachability; the maximum-text content is not claimed to fit simultaneously in one viewport.

AFTER screenshots contain fictional values entered during testing and differ from the blank BEFORE state: normal Light shows Female/179.9 LB/30; normal Dark shows Prefer not to say/179.9 LB/30. A final public-UI inventory verifies Prefer not to say/179.9 LB/30 and the existing rounded LB 1RMs 100.1/225.1/315. The dedicated fixture ends Light/large with its keyboard closed and those body fields still entered; the original compact guest ends at empty Signup. No Health data or permissions are involved.

The shared cyan Skip header and its maximum-text limitations remain outside this screen refinement. Native evidence does not claim a physical-device or Android run, VoiceOver audio, OS Reduce Motion execution, or native frame timing. Harness motion cases verify preserved structure and configurations. These are five completed configuration results, with the precondition retry documented in the screenshot README; they are not a claim that every invocation passed. Unit round trips retain existing rounding rather than exact mathematical restoration, and the entered body fixture is not claimed to be blank again.

## Dependencies and rollout

No API changes, database migrations, dependency updates, Health permission changes, or special rollout are required. The user's untracked design directory and local roadmap remain excluded. This PR awaits code and photo review and is not automatically merged.

## Screenshot review

Before, normal Light with all required fields blank and LB selected:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-before-light-initial.png" width="320" alt="Original Body Stats in Light with blank required fields and disabled NEXT" />

After, normal Light with different data: fictional Female/179.9 LB/30 entered during testing:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-light-entered.png" width="320" alt="Final Body Stats in Light with neutral controls and fictional Female, 179.9 LB, age30 values" />

<details>
<summary>Original Dark empty state and real empty-weight keyboard</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-before-dark-initial.png" width="320" alt="Original Body Stats in Dark with blank required fields and disabled NEXT" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-before-dark-keyboard-empty.png" width="320" alt="Original Body Stats in Dark with the actual numeric keyboard and cyan focus on empty weight" />

</details>

<details>
<summary>Final Dark form and real Light/Dark keyboards</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-dark-entered.png" width="320" alt="Final Body Stats in Dark with fictional Prefer not to say, 179.9 LB, age30 values" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-light-keyboard.png" width="320" alt="Final Body Stats in Light with the actual numeric keyboard and complete Continue frame" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-dark-keyboard.png" width="320" alt="Final Body Stats in Dark with the actual numeric keyboard and complete Continue frame" />

</details>

<details>
<summary>Final cold maximum-text Light/Dark and compact Light empty state</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-light-max-bottom.png" width="320" alt="Final Body Stats at cold maximum text in Light with readable lower fields and complete Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-dark-max-bottom.png" width="320" alt="Final Body Stats at cold maximum text in Dark with readable lower fields and complete Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/u21-after-compact-light-disabled.png" width="320" alt="Final Body Stats on compact Light with blank required fields and disabled neutral Continue" />

</details>

[Screenshot provenance and native configurations](https://github.com/DiegoZG/PrimeRep-AI/blob/U21_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u21/README.md)

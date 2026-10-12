# U19 One Rep Max UI refinement

One Rep Max previously gave the calculator and selected unit the same purple emphasis as NEXT, while its three narrow trailing inputs crowded exercise labels. The screen now uses a neutral secondary calculator, readable gray unit selection, and stacked full-width inputs with neutral focus. Continue remains the primary purple action in the keyboard-avoiding layout.

## Changes and preserved contracts

- Keep the exact question, description, Calculator heading, exercise names/order, placeholder, numeric keyboard type, and existing unit action labels. Use the existing neutral theme and system font, with readable description text and uncapped natural metrics.
- Give the existing calculator a neutral outlined surface and a 44-point minimum target. Its unchanged calculator icon uses neutral text color and is hidden as decoration; its existing accessible button name remains exact.
- Keep LB/KG in a segmented control with readable theme text, gray selected paint, and the existing explicit selected state. Unit labels grow naturally without a font cap.
- Stack Bench Press, Back Squat, and Deadlift labels above full-width inputs. Each actual TextInput has an accessible name containing its exercise and current pounds/kilograms unit. Reuse the existing AnimatedInput `authPresentation` opt-in for neutral focus; the shared component remains unchanged.
- Put the existing dismiss TouchableWithoutFeedback inside the ScrollView around form content only, with `accessible={false}` so the form does not merge its individual controls. It does not wrap the scroller or footer. Keep the existing dismiss handler, handled taps, keyboard avoidance behavior and offsets, and drag dismissal on the inset-aware ScrollView.
- Put the actual Continue button beneath the ScrollView as an in-flow sibling inside the existing keyboard-avoiding layout, with a 56-point minimum height and a full-width centered, nonshrinking label. Its footer has no fixed height or absolute positioning. It remains enabled because all three maxima are optional.

The entire 5,716-byte One Rep Max controller before its return remains byte-identical to merged main `e68e9de49bca3965e4c6d0b0e26cb9c6ed1fda1e`. This preserves local/context synchronization and calculator-return updates, all three original parseFloat and positive/1500-bound handlers, optional-field semantics, unit conversion and rounding for body weight and all three maxima, same-unit no-ops, general/exercise calculator URLs, unconditional `/onboarding/fitness-goal` navigation, keyboard dismissal, screen transition, and entrance timing. No validation, conversion, modal, navigation, storage, or provider behavior is repaired or expanded.

## Verification

- Before production edits, all 445 existing tests passed: 444 regressions and the UI-action audit self-test. The new unchanged-screen baseline passed 34 meaningful cases.
- The final U19 harness passes 44/44: those same 34 behavior/controller/motion cases plus ten presentation checks. It does not duplicate behavior cases with historical renders. Both themes cover three valid field writes, upper bounds, empty/zero/negative/over-limit/partial parseFloat behavior, restored values, external calculator context updates, both unit conversions including body weight and rounded maxima, same-unit no-ops, existing provisional invalid-field unit-switch semantics, optional repeated Continue actions, calculator URLs, keyboard dismissal, and real input/button motion. An Android boundary case preserves the existing keyboard height behavior and zero offset; it is not a native Android run.
- The harness loads the actual screen, OnboardingProvider, AnimatedInput, AnimatedButton, weight conversion, theme/font constants, and transition hook. Native rendering/animation, router, authentication context, icon rendering, and storage boundaries are mocked. A test-only capture exposes the actual existing optional calculator handler to exercise its supported exercise URLs; it adds no production control or export.
- Presentation checks verify neutral calculator paint and decorative accessibility, explicit gray unit selection, individually named numeric inputs, real neutral focus/blur styling, full-width stacked controls, scroll containment of all form controls, an in-flow sibling footer inside the existing keyboard-avoiding layout, optional primary-action semantics, target minimums, contrast, and uncapped natural text. Font-scale cases verify structural layout properties rather than native glyph geometry.
- Final source passes all 489 full-suite cases, including 445 existing cases and 44 U19 checks with explicit keyboard-avoiding sibling-footer and content-only dismiss-wrapper assertions. Lint, interaction audit, and diff checks pass.

- Independent verification of final frozen source `b829b84d1e31b5ac37b6e0121a437f5cd532c4ac9bfd41954c75b6fb597cd273` passes 128 focused cases, including eighteen calculator regressions, and all 489 full-suite cases. Lint, typecheck, interaction audit, audit self-test, and diff checks pass. A fresh cache-cleared export with `EXPO_NO_DOTENV=1` succeeds for 62 routes; actual HTML, embedded presentation, and the temporary verification API URL `https://api.primerep.invalid` are checked. Review confirms the exact 5,716-byte controller, shared components/conversion/auth contracts, common guard, and four approved callers with no remaining findings.

## Historical guards and independence

The existing Login and Signup harnesses limited neutral-input callers to their two screens and the shared component. This PR adds exactly one authorized caller, `app/onboarding/fitness-experience/one-rep-max.tsx`, yielding the exact four approved paths. Both migrated checks also assert the complete unchanged One Rep Max controller against the merged-main baseline. Login/Signup controllers, the shared AnimatedInput implementation and legacy-input checks, and every other existing contract remain intact. This is a specific caller extension, with no broad exclusion or allowance for future screens.

The branch starts from the same merged main plus shared test-only Welcome guard commit `ef6c5e3a32a86ebea364ea864ad93ab4a524afd7`. It does not depend on U17 or U18 production UI, tests, assets, or documentation. The new U19 harness guards only its own controller and content, with no global Git-diff assertion or freeze of unrelated planned routes.

## Native evidence and limits

Five native configurations pass on final frozen source: standard Light/Dark keyboard checks and cold maximum-text Light/Dark layout checks on iPhone 16 Plus, plus a compact iPhone SE Light read-only blank-state check. Every published after image is from that final source; before originals were captured before implementation. All ten copies match their unchanged simulator originals.

Both normal-theme checks show the actual numeric keyboard and the entire Continue frame above it. Exactly one tap opens Fitness Goal with the keyboard hidden; returning retains Deadlift 315. Both cold maximum-text checks actually scroll to the calculator, LB/KG, and all three labels, inputs, and unit suffixes, with intact enlarged glyphs and a fully readable Continue. They are layout checks with the keyboard absent, not maximum-text route/conversion runs. The compact guest shows three blank optional fields and enabled Continue, then returns to empty Signup without edits. Final drag dismissal also preserves the fixture values.

Native testing caught and resolved two local layout problems: the initial in-scroll action was covered by the keyboard, and an outer dismiss responder blocked maximum-text scrolling. Final first-tap and actual scroll/glyph checks verify the sibling footer and content-only dismiss wrapper. Maximum-text evidence uses cold launches because warm OS font changes produced mixed measurements; a general live-font-resize fix is not claimed.

Earlier source versions verified entry and LB/KG rounding, background dismissal, and calculator cancel plus the actual 5 reps × 100.5 lb → 113 lb Bench Press estimate/apply. These are not claimed as complete final-source math/modal reruns. The calculator/controller is unchanged and all eighteen calculator regressions pass. A later visible modal returned an empty automation hierarchy and was closed through observed native Cancel coordinates; final ID-driven apply and VoiceOver traversal are not claimed.

The fictional fixture retains 100.1/225.1/315 lb, Advanced experience, and its existing reason, with Light/standard `large` settings restored. The original compact guest is back at empty Signup; no state or credentials were cleared. Detailed modes, provenance, restoration, and limits are in [the native evidence README](https://github.com/DiegoZG/PrimeRep-AI/blob/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/README.md). Failed intermediate captures are excluded. Shared cyan Skip/header limitations remain outside scope; Android, physical devices, native animation timing, and OS Reduce Motion are not established by this matrix. Native body-weight conversion is not claimed; real controller/unit tests cover its preserved logic.

## Scope and rollout

Only `app/onboarding/fitness-experience/one-rep-max.tsx` changes production source. Supporting files are the U19 harness, the two precise Login/Signup caller-guard migrations, `.maestro/one-rep-max-refinement.yaml`, the unique `docs/pr-screenshots/u19/README.md`, this narrative, and approved screenshot originals. Shared components, font/theme tokens, headers, navigation, modal implementation, providers, APIs, storage implementation, legal content, dependencies, native configuration, and backend source remain unchanged. No migration or special rollout is required. The user's untracked `DESIGN-IS-2026-10-11/` directory and local app-wide roadmap remain excluded. This independent PR awaits review and is not automatically merged.

## Screenshot review

Before, normal Light with the original fictional 100 lb entry:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-before-light-entered.png" width="320" alt="One Rep Max before, normal Light with narrow input and purple secondary controls" />

After, normal Light with the final fictional 100.1/225.1/315 lb values:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-light-entered.png" width="320" alt="Final One Rep Max, normal Light with neutral controls and stacked full-width inputs" />

<details>
<summary>Before: optional blank fields and original keyboard footer</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-before-light-initial.png" width="320" alt="One Rep Max before, normal Light with three optional blank fields" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-before-dark-keyboard.png" width="320" alt="One Rep Max before, Dark with original NEXT above the numeric keyboard" />

</details>

<details>
<summary>Final: Dark controls, real keyboard reachability, maximum text and compact blank state</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-dark-entered.png" width="320" alt="Final One Rep Max, normal Dark with individually named full-width inputs" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-light-keyboard.png" width="320" alt="Final One Rep Max, Light with complete Continue above the actual numeric keyboard" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-dark-keyboard.png" width="320" alt="Final One Rep Max, Dark with complete Continue above the actual numeric keyboard" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-light-max-bottom.png" width="320" alt="Final One Rep Max, cold maximum-text Light with readable lower fields and complete Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-dark-max-bottom.png" width="320" alt="Final One Rep Max, cold maximum-text Dark with readable lower fields and complete Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U19_ASSET_COMMIT_FULL_SHA/docs/pr-screenshots/u19/u19-after-compact-light-blank.png" width="320" alt="Final One Rep Max, compact Light with three blank optional inputs and enabled Continue" />

</details>

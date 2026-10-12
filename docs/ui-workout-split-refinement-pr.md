# U25 Workout Split UI refinement

Workout Split previously emphasized selected cards, checkboxes, and the Recommended tag in purple alongside NEXT. Preset selections now use a neutral border and a small neutral animated checkmark, tags remain readable within the content, and the enabled Continue button owns the purple emphasis. Custom is an explicit route button with a chevron. The actual Continue button scrolls after all eleven choices so growing text and the lower cards can share one inset-aware content flow.

Before, normal Dark with PrimeRep Optimized selected:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-before-dark-selected.png" width="320" alt="Original Workout Split in Dark with PrimeRep Optimized selected and purple selection treatment" />

After, normal Dark with the neutral selected preset treatment; the complete Continue frame appears in the collapsed details below:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-dark-selected.png" width="320" alt="Final Workout Split in Dark with a neutral selected preset border and checkmark" />

## Changes and preserved contracts

- Preserve all eleven choice IDs, order, titles, descriptions, tag text and types, including the literal PrimeRep Optimized title, its bounded explanation, and its sparkle emoji. Use existing system fonts, a 28-point/600 heading, and readable `colors.icon` helper and description text.
- Keep two-point card borders stable across selection. Ten presets expose one radio each with an explicit checked state and a label containing their exact title, description, and tag. The existing AnimatedCheckmark stays decorative and retains its motion.
- Render Custom as a neutral button with a decorative chevron and no checkbox or checked state. A restored Custom selection retains its neutral selected border and explicit selected accessibility state. Tapping it immediately opens `/onboarding/workout-split/custom`, writes no field, and retains the previous local selection and persisted draft.
- Put the actual full-width Continue button, with a 56-point minimum height and naturally growing centered label, inside the automatic-inset ScrollView. Empty selection disables it with neutral paint; an existing selection enables its purple action.

The entire 6,752-byte controller before its return remains byte-identical to base `6ffc2364bf5203127b71829f4c527583b6063460`; controller SHA256 is `d39002613718dbe7667ad6eb87cf3fda759e4aced9bc5793ea4a7f9305fe60f7`. The guard also freezes the complete pre-return source with only the two required presentation import substitutions allowlisted. `WORKOUT_SPLIT_SCREEN` alone is guarded rather than freezing unrelated constants.

Restored selections, writes to the real OnboardingProvider, persistence, replacement and repeated taps, screen transitions, all eleven entrance stagger positions, checkmark animation, and button press feedback retain their behavior. The existing local-state quirks remain: external context changes do not update selection until remount, and a restored `custom` value still enables Continue to `/onboarding/variety-level`. Selecting Custom directly does not set that value.

Only `app/onboarding/workout-split/index.tsx` changes in production. Shared cards, controllers, providers, hooks, theme, content constants, header, authentication, API, migrations, native configuration, dependencies, and other screens remain unchanged.

## Verification

- Before production edits, the harness passed 19 meaningful behavior/controller/motion cases against the unchanged current screen in both themes. Those same cases pass on the final presentation, plus ten distinct presentation cases: 29/29. Historical renders are not counted again as duplicate baseline cases.
- The harness loads the actual screen, OnboardingProvider, AppearanceProvider, AnimatedButton, AnimatedCheckmark, ThemedView, transition and theme hooks, and theme/font constants. It mocks only native rendering/animation and icon boundaries, routing, authentication context, and storage. Both themes cover every preset from fresh and restored state, replacement, repeated writes and routes, persistence and provider remount, direct Continue gating, Custom immediate routing/no-write/selection retention, and external-context quirks.
- Presentation checks cover ten exclusive radio states, Custom button/chevron semantics even with a Custom prefill, decorative indicators, stable neutral borders, exact content and readable contrast, enabled-only purple paint, real button press feedback, and natural text/scroll structure at normal and large font-scale inputs. Structural tests do not claim native glyph measurements.
- Independent verification of the frozen final source passes 29/29 U25 cases, 661/661 named full-suite cases, and 662/662 in the standard `node --test scripts/test-*.mjs` run, which includes the audit self-test file runner once. The focused U25 count is included in the full total, not added to it. Lint passes with two existing shared-component warnings; typecheck, interaction audit, audit self-test, and diff whitespace checks pass.
- A fresh cache-cleared web export with `EXPO_NO_DOTENV=1` produces 62 actual HTML files. Emitted `entry-5774e4c4957808dc347e995d505acda0.js` contains the Workout Split scroll/question/option/chevron/Continue selectors and the temporary verification API URL `https://api.primerep.invalid`.

The frozen final screen SHA256 is `5abe41b8175b65785743c3f90fac81ed8accac7629ac99e0181aa460081153aa`. Local logs are preserved at `/private/tmp/primerep-u25-impl-MZzb3n` (`baseline.log`, `behavior-final.log`, `focused.log`, `full.log`, `lint.log`, `types.log`, `audit.log`, and `export-final.log`). The `behavior-final.log` and `export.log` artifacts predate the scoped Custom-prefill correction; the final focused/full/export logs verify the frozen source.

## Native evidence and limits

Five iOS 18.5 Simulator configurations pass on the existing development binary: normal Light and Dark, cold maximum-text Light and Dark, and compact Light with an empty selection. The two normal runs collectively exercise all ten actual preset radios, five per theme, with checked-state replacement assertions. Both runs open the actual empty Custom list without day edits, return through the public route with Optimized retained, reach the whole Continue frame above the safe area, and use actual Continue to reach Variety Level before returning. These return checks use public routes/remounts rather than the header Back handler.

Both cold maximum-text runs inspect the whole question/helper and representative Optimized title, emoji, and bounded explanation through overlapping private raw captures, reach the original tags and Custom chevron, activate an actual preset, and show the whole grown Continue frame above the safe area. These are layout checks, not another maximum-text forward-route run. Oversized lower cards can span multiple viewports; the published maximum bottom images show the description tail and complete footer. Coverage does not claim all eleven choices or every lower description in one frame. The compact read-only run reaches all ten unchecked preset radios and disabled Continue, then returns to empty Signup without changing choices or fields.

The screenshot set contains exactly three genuine original BEFORE and seven final-source AFTER images, all visually accepted in coordinator review. The BEFORE source SHA256 is `73a3ed9fd336755d5f1f0432a5a2182c0dbacc74f791f051796ef8f9b7358e29`; every AFTER run and final source check matches the frozen final hash above. All ten published raw copies match their unmodified originals byte for byte (`cmp`: 10/10). Private originals, companion glyph captures, restoration, and cleanup evidence remain at `/private/tmp/primerep-u22-u23-u25-native-ZRoGID`.

Two read-only glyph-proof flows, one fictional-choice restoration flow, and two cleanup flows also pass; these are supplemental checks, not additional configurations. Three failed tooling invocations are excluded: two visibility/scroll-direction assertions were corrected in the owned flows, and one YAML parse error occurred before device actions. None required production edits or is counted as a native pass.

Both devices are restored through the public development-client route to the existing usual server on 8081. The fictional fixture retains Optimized, three-day frequency, and Large Gym with Light appearance, Large text, and no keyboard; the compact guest is back at empty Signup in Light/Large without a keyboard. The owner then stopped only the private server, verified no 8083 listener, and preserved usual 8081, backend 8000, and Python 8082 listeners.

The shared header's maximum-text clipping remains outside this screen refinement. Native coverage is iOS Simulator only: no physical-device, Android, VoiceOver audio, OS Reduce Motion execution, or native animation frame-timing claim. The screenshot README records configuration details, provenance, bounded glyph evidence, tooling retries, and reproduction commands.

## Independence, dependencies, and rollout

This independent branch starts at `6ffc2364bf5203127b71829f4c527583b6063460`. Its harness guards only its own screen/controller and its own content object, with no global Git-diff assertion or unrelated content freeze. It has no code or artifact dependency on the sibling Training Frequency or Training Place branches. Training Frequency PR #72 subsequently merged to main; the checks here verify this historical independent base and do not yet claim verification of the composed current-main result.

No API change, migration, dependency update, or special rollout is required. The user's untracked design directory and local roadmap are excluded. Independent code QA and native review pass. Prepared for review; no automatic merge is planned.

## Screenshot review

Screenshots and provenance link to the immutable asset commit. The two normal Dark comparisons appear directly below the opening summary; the remaining eight accepted originals are collapsed here for phone-friendly review.

<details>
<summary>Original Light and Dark empty states</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-before-light-initial.png" width="320" alt="Original Workout Split in Light with no selection" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-before-dark-initial.png" width="320" alt="Original Workout Split in Dark with no selection" />

</details>

<details>
<summary>Final normal Light and complete Light/Dark Continue frames</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-light-selected.png" width="320" alt="Final Workout Split in Light with a selected preset" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-light-bottom.png" width="320" alt="Final Workout Split in Light with lower choices and the full Continue frame" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-dark-bottom.png" width="320" alt="Final Workout Split in Dark with lower choices and the full Continue frame" />

</details>

<details>
<summary>Final cold maximum-text Light/Dark and compact Light empty state</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-light-max-bottom.png" width="320" alt="Final Workout Split at cold maximum text in Light with Continue reached through scrolling" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-dark-max-bottom.png" width="320" alt="Final Workout Split at cold maximum text in Dark with Continue reached through scrolling" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/u25-after-compact-light-disabled.png" width="320" alt="Final Workout Split on compact Light with no selection and disabled neutral Continue" />

</details>

[Screenshot provenance and native configurations](https://github.com/DiegoZG/PrimeRep-AI/blob/__U25_ASSET_COMMIT_SHA__/docs/pr-screenshots/u25/README.md)

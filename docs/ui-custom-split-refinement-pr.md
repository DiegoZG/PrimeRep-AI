# Refine Custom Split actions and readable workout cards

Custom Split now makes Add workout neutral, reserves purple for enabled Continue, and displays complete muscle names as readable text. Separate named Edit and Remove controls retain pressed feedback and identify the displayed workout number, distinguishing duplicate names. Add workout and Continue grow with text inside the inset-aware scroller.

Before, original Dark empty Custom Split:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-before-dark-initial.png" width="320" alt="Original Dark Custom Split with an empty workout list, minimum-one-day validation and disabled Continue" />

After, final Dark empty Custom Split:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-dark-empty.png" width="320" alt="Final Dark empty Custom Split with neutral Add workout, readable validation and disabled Continue" />

Both images show empty data on iPhone 16 Plus. BEFORE uses the original C3 guest; AFTER uses the separate approved A21 fictional fixture. They are not the same guest. No populated BEFORE exists; populated AFTER images show new fictional test days.

Independent verification passes 37 focused cases, 669 named cases, and 670 standard Node results with the audit wrapper counted once. Five iOS configurations and separate exact-own-ID removal and split-choice restoration passed. All nine published originals match raw captures byte for byte.

[Screenshot provenance, native matrix, state boundaries, and reproduction](https://github.com/DiegoZG/PrimeRep-AI/blob/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/README.md)

<details>
<summary>Light empty comparison and original compact empty-state result</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-before-light-initial.png" width="320" alt="Original Light empty Custom Split with disabled Continue on the original C3 guest" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-light-empty.png" width="320" alt="Final Light empty Custom Split with neutral Add workout and disabled Continue on the separate fictional A21 guest" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-compact-light-disabled.png" width="320" alt="Final compact Light empty Custom Split with the complete disabled Continue action" />

</details>

<details>
<summary>Final populated Light and Dark with new fictional test days</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-light-populated.png" width="320" alt="Final Light Custom Split with two new fictional Upper body days and a Custom day; data differs from empty BEFORE" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-dark-populated.png" width="320" alt="Final Dark Custom Split with the same three new fictional days and separate named Edit and Remove actions" />

The actual duplicate preset titles are Upper body - Workout 1 and Upper body - Workout 2. The Custom day has thirteen real muscle selections and Core remained off. Arbitrarily long names are component-harness coverage only: the unchanged original modal has no name input. These are not matched populated BEFORE/AFTER comparisons.

</details>

<details>
<summary>Final cold maximum-text Light and Dark action reach</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-light-max-bottom.png" width="320" alt="Final Light Custom Split at cold maximum accessibility text with list tail, Edit, grown Add workout and full Continue above the safe area" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/2fb00e0aa7dc15a9b32428a1bb395b6282587178/docs/pr-screenshots/u26/u26-after-dark-max-bottom.png" width="320" alt="Final Dark Custom Split at cold maximum accessibility text with the same growing actions above the safe area" />

The maximum-text Custom card is taller than a viewport. Whole title and thirteen-muscle glyphs were inspected across overlapping private originals and two bounded slow drags; these bottom frames alone do not show every glyph. Automated centering sometimes put a helper under the shared header or past its target, so actual top/title companions supplied the visible evidence. No font cap, fixed-height workaround, or all-app header perfection claim is made.

</details>

<details>
<summary>Scope and preserved behavior</summary>

## Scope and preserved behavior

Only `app/onboarding/workout-split/custom.tsx` changes in production. Its actual-screen harness, scoped native flow, review document, screenshot README, and nine untouched originals provide evidence. Shared components, providers, helpers, constants, interfaces, theme, API, database, Health, authentication, dependencies, and adjacent screens remain unchanged. Edit and Remove have separate minimum 44-point targets and existing 0.7-opacity press feedback; Add workout and Continue have minimum 56-point targets.

The 3,021-byte function controller remains identical to base `6ffc2364bf5203127b71829f4c527583b6063460`, SHA256 `61e7252e9c440aa5486341ac04d404a1bcf9b486ce9213b9f7d72fe0a2209b75`. The complete `CUSTOM_SPLIT_SCREEN` object is unchanged. The exact `{name} - Workout {index + 1}` card titles, muscle IDs and unknown-ID fallback, ID-based editing/removal, edit parameter names and comma-separated muscles, day order, provider persistence, and animation timings remain unchanged.

One workout day still enables the actual Continue button regardless of selected training frequency; there is no new frequency requirement or day limit. The existing direct-handler quirk is preserved: invoking Continue's handler directly with no workout days still sets `workoutSplit` to `custom` and pushes `/onboarding/variety-level`. The empty UI button remains disabled and shows the existing validation sentence.

System fonts, natural text wrapping, theme-readable helper text and validation, flexible card titles, and a scrollable footer support larger text without introducing line caps, fixed text heights, reordering, or new business logic.

</details>

<details>
<summary>Component tests and independent engineering verification</summary>

## Verification

- Original route: 26 meaningful baseline cases passed before production edits. Eleven distinct presentation cases were added first and failed against the original presentation. The refined route passes 37/37: the same 26 baseline cases plus those 11 presentation cases. Historical rendering is not duplicated to inflate counts.
- The harness renders the actual screen with real AppearanceProvider, OnboardingProvider, theme hooks, ThemedView, AnimatedButton, and screen transition. Native rendering/animations, router, storage, authentication context, and vector icons are mocked boundaries. Both themes cover exact add/edit params, matching names with distinct IDs and accessibility labels, actual native Pressable style callbacks for pressed and released states, removal/order/last-day validation, all muscle labels and unknown IDs, unrelated data, remount/full restoration, persistence, appearance changes, and existing motion. These additions extend the existing target/presentation cases; the count remains 37.
- Full standard `node --test scripts/test-*.mjs`: 670/670 passed, including the interaction-audit self-test once. Standalone interaction audit, typecheck, diff checks, and strict zero-warning lint of both changed code files pass.
- Independent verification at `/private/tmp/u26-independent-verify.XAnX4F` confirms 37/37 focused cases, 669/669 named cases excluding the audit wrapper, and 670/670 standard Node results with that wrapper counted once. Typecheck, interaction audit and its self-test, zero-warning scoped lint, and diff checks pass. Independent export emits 62 actual HTML files and `entry-323b3228aa058185769265e3bc099b71.js`; compiler/artifact checks do not certify native layout.
- Normal `EXPO_NO_DOTENV=1 npm run lint` passes with two inherited hook-dependency warnings in `animated-checkmark.tsx` and `hero-neon-line.tsx`. Broader raw ESLint also exposes inherited warnings and an undefined `Buffer` in `scripts/test-apple-health-adapter.mjs`; those unrelated files are not changed.
- Fresh cache-cleared Expo web export after the press-feedback and label refinements, with `EXPO_NO_DOTENV=1` and temporary HTTPS API `https://api.primerep.invalid`, produces 62 actual HTML files, including Custom Split. Emitted `entry-26460c62c1fc59e5449f428418b7cc46.js` contains all Custom Split selectors and the temporary API. This is compiler/artifact verification, not browser or native validation.
- Implementation screen SHA256: `2b1a074a5f9c42f8fe54b4a6401a24ecab7ff61db9bc4de5ad8eadd0c951776a`. Harness SHA256: `620827bf2b8233daae0347ce380028692726601f1db658a9e8b00fd0807717fb`.

</details>

<details>
<summary>Native coverage, tooling retries, and restored state</summary>

## Native evidence

Root verified genuine Light and Dark BEFORE initial captures against original route SHA256 `7ffc8ed95cf04ee075b0e817b11067c1c88f6af1a29686fc38d64e0cb364e7b4`. Both show an empty workout list, the minimum-one-day validation, and disabled Continue. No populated BEFORE capture exists. Root supplied the private raw originals at `/private/tmp/u26-u27-before.5tWlCZ/u26-before-light-initial.png` and `/private/tmp/u26-u27-before.5tWlCZ/u26-before-dark-initial.png`.

Five iOS 18.5 configurations passed on the existing custom development binary through staged native flows: normal Light/Dark interactions, cold maximum accessibility text in Light/Dark, and compact Light read-only empty state. Fourteen Maestro invocations passed, including three creation stages, separate exact-own-ID removal, split-choice restoration, and two usual-server cleanup flows. Two failed tooling/preflight invocations are excluded from pass counts.

The A21 fixture was actually empty before writes. The unchanged Add modal created two Upper body days with Chest, Back, Shoulders, Biceps and Triceps; the Custom day has Chest, Back, Biceps, Glutes, Shoulders, Triceps, Quads, Hamstrings, Calves, Adductors, Abductors, Forearms and Trapezius. Core was never toggled; Abs and Lower back were not selected. No storage/context injection, fabricated payload, or backend mutation supplied those days.

Normal Light proves one day enables Continue despite three-day frequency, actual Continue reaches Variety Level (7/9), and public route return retains that day. Both normal themes prove exact three-day order/muscles and route/remount persistence. Actual Edit opens the second Upper or Custom prefill, followed by a real native sheet swipe-cancel without Update. Public deep-link returns are not a header Back-handler test; exact payload parameters and unknown-ID fallback are component-harness evidence.

The separate normal Dark removal run targets only the three actual test-created IDs recorded in the README: second Upper, first Upper, then Custom. Middle removal renumbers retained cards; one remaining day still enables Continue and survives a public route return; last removal restores empty validation and disabled Continue. Deleted fictional days have no Undo control; the fixture's originally empty list is restored.

Normal native Remove frames measured 44×44 pt; Upper Edit 348×56 pt; Custom Edit 348×92 pt; Add and Continue 382×56 pt. Light maximum Add grows to 166 pt and Continue to 98 pt, completely above the content/safe-area boundary. Maximum-text layout is read-only, with no modal submission, removal, or forward-route claim. Native frames are distinct from source minimums and do not prove VoiceOver audio.

The first Add-opening invocation failed an exact-title assertion because the unchanged original modal merges controls into one accessibility node. The visibly open modal wrote no day in that invocation. Subsequent bounded observed point taps on the original normal-text modal passed creation/prefill; no production modal fix was made. Initial usual-server cleanup failed keyboard preflight when unchanged First name bootstrap autofocused the retained fictional name. Moving the check after public Custom navigation resolved cleanup without typing or field edits; the retry is excluded from candidate passes.

After all candidate evidence and exact-own-ID removal, public AI Optimized restoration passed. Both guests reconnected to actual usual Metro 8081. The fixture finished with empty Custom list, three-day frequency checked, Large Gym checked, AI Optimized checked, Light/Large text and no keyboard. Compact finished at empty Signup, Light/Large text, no keyboard, without choice or field writes. Other fictional draft fields were preserved. Private cleanup originals verify actual usual-server surfaces and are excluded from candidate images.

The isolated U26 runtime used the existing APFS dependency clone. An initial sandbox launch failed with the socket-range limitation before binding. The approved elevated command served an actual HTTP-200 SDK-54 manifest and actual HTTP-200 iOS launch asset with candidate selectors and the approved API URL; no native pass is attributed to the failed launch. After verified cleanup, its owner stopped only session 73679/PID 89813 under root authorization; no 8083 listener remained. Usual Metro 8081/PID 77763, Python 8082/PID 22150 and backend 8000/PID 77326 stayed intact.

No login/signup submission, Equipment/default initialization, Variety Next, Health, permission prompt, private storage inspection, state clear, keychain reset, native rebuild, authenticated simulator, or backend mutation was used. Coverage is iOS Simulator only, with no Android, physical-device, VoiceOver spoken traversal, OS Reduce Motion, or native animation frame-timing claim.

</details>

<details>
<summary>Canonical raw-image hashes</summary>

The two BEFORE originals are from `/private/tmp/u26-u27-before.5tWlCZ`; the seven AFTER originals are from `/private/tmp/primerep-u26-native-UzdIEA`. All nine canonical copies pass `cmp` against untouched originals. No cropping, overlays, resizing, composites, or recreated screenshots were used. All nine were visually accepted by the coordinator; the complete provenance README was read.

| Asset | State/caption | Asset SHA256 |
| --- | --- | --- |
| `u26-before-light-initial.png` | Genuine original empty C3 guest | `d08b18007f5573a48edbabc4b9b8d7737b022cc225bcff808caf6ecd5582f9d5` |
| `u26-before-dark-initial.png` | Genuine original empty C3 guest | `481e9ecbd08dec61f8ddb7760082855669a2541dbb4091dcabf25beb737aee69` |
| `u26-after-light-empty.png` | Final empty A21 fixture | `6059b0428463d6961cf0dba625baf52c68c7cb8bb8cd2d70eef97bde30a0c388` |
| `u26-after-dark-empty.png` | Final empty A21 fixture | `431a64438894499954e2b79d74a07814970720ee74fa0314518e8ffbbf5e8c99` |
| `u26-after-light-populated.png` | New fictional data, different from empty BEFORE | `45a0cfeb2b36b24b19f6fcc0a0bdffd3065dc7b17736b1a58649c2361685bec1` |
| `u26-after-dark-populated.png` | Same new fictional data | `5934bed8e2eb08f491f94cacd7024f4acd8b1bce8f307fc7cd3f84765277a455` |
| `u26-after-light-max-bottom.png` | Cold maximum-text action reach | `7f6c7ad21cccfc0951b180f062ee13bddcdf160e072f4b8a6ee7465a6df331e6` |
| `u26-after-dark-max-bottom.png` | Cold maximum-text action reach | `adbdd85a79ef2ae692bbc4f952f36d81afb6a663d4ab05ef363de4ffadf14e3f` |
| `u26-after-compact-light-disabled.png` | Original compact empty guest | `797ec23191bbc0bc520bf980fd808359ab4e7dab7af59b5d7ad3aca689e1bd34` |

</details>

<details>
<summary>Dependencies and rollout</summary>

## Dependencies and rollout

This isolated branch starts at `6ffc2364bf5203127b71829f4c527583b6063460`. No API change, migration, installation, dependency-version change, or special rollout is required. The user's untracked design directory and roadmap remain excluded. Engineering and native verification cover this independent historical base; they do not claim verification of the composed current-main result. Screenshots and provenance are pinned to the immutable asset commit. Prepared for review; no automatic merge is planned.

</details>

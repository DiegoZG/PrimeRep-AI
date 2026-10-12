# U23 Training Place UI refinement

Training Place keeps its three familiar equipment-access cards, with readable descriptions and a neutral selected border and animated check. Each card exposes one checked radio. The actual Continue button scrolls with the cards, grows with enlarged text, and uses purple only when a choice enables it.

Before, normal Dark with Large Gym selected:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-before-dark-selected.png" width="320" alt="Original Training Place in Dark with Large Gym selected through a purple border, fill, and checkbox" />

After, normal Dark with the same Large Gym choice:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-dark-selected.png" width="320" alt="Final Training Place in Dark with Large Gym selected through a neutral border and animated check" />

The actual-screen harness passes 23 cases; independent verification passes 655 named cases and 656 standard Node results with the audit runner counted once. All five iOS configurations and the additional restoration flow passed on the frozen screen. All ten published images match their raw originals byte for byte.

[Screenshot provenance, native matrix, state boundaries, and reproduction](https://github.com/DiegoZG/PrimeRep-AI/blob/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/README.md)

<details>
<summary>Original Light and Dark empty states</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-before-light-initial.png" width="320" alt="Original Training Place in Light before a choice is selected" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-before-dark-initial.png" width="320" alt="Original Training Place in Dark before a choice is selected" />

</details>

<details>
<summary>Final normal Light selection and complete Light/Dark Continue frames</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-light-selected.png" width="320" alt="Final Training Place in Light with Large Gym selected through a neutral border and check" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-light-bottom.png" width="320" alt="Final Training Place in Light scrolled to the complete enabled Continue button above the safe area" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-dark-bottom.png" width="320" alt="Final Training Place in Dark scrolled to the complete enabled Continue button above the safe area" />

The normal bottom captures intentionally scroll the question partly under the shared header so the complete action is visible.

</details>

<details>
<summary>Final cold maximum-text Light/Dark and compact Light empty state</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-light-max-bottom.png" width="320" alt="Final Training Place at cold maximum accessibility text in Light with its complete grown Continue button visible" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-dark-max-bottom.png" width="320" alt="Final Training Place at cold maximum accessibility text in Dark with its complete grown Continue button visible" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/U23_IMMUTABLE_COMMIT_PENDING/docs/pr-screenshots/u23/u23-after-compact-light-disabled.png" width="320" alt="Final compact Light Training Place with three unchecked choices and disabled neutral Continue" />

At maximum text the long Large Gym card spans more than one viewport. Actual helper and all three titles/descriptions were inspected through overlapping private top, description, and selection captures, followed by the complete grown Continue frame. These published bottom images alone do not show every glyph. Actual Small Gym activation passed in Dark and Garage Gym activation passed in Light. The shared native header can obscure the first line of a centered accessibility snapshot; top and companion captures were inspected instead of relying only on visibility percentages. No font cap or production workaround was added.

</details>

<details>
<summary>Changes, design decisions, and preserved behavior</summary>

- Keep the exact `TRAINING_PLACE_SCREEN` object, including all three ordered IDs, titles, and descriptions: `large-gym` / Large Gym, `small-gym` / Small Gym, and `garage-gym` / Garage Gym.
- Follow the existing local U20/U18 option pattern with stable two-point borders, existing neutral card surfaces, readable `colors.icon` helper/description paint, and a neutral animated check. Shared SelectableOptionCard is unchanged.
- Give each card one accessible radio with an explicit checked state and an exact title-plus-description label. Hide its decorative indicator from accessibility navigation while retaining AnimatedCheckmark motion.
- Use existing system sans type: 28-point/600 question, 17-point/600 titles, and 15-point helper/descriptions. Text has natural metrics without a line limit, fixed height, or font cap.
- Put the actual full-width Continue button inside the automatic-inset ScrollView. Its 56-point minimum height and naturally growing centered label remain neutral and disabled for empty selection, then enable the existing purple action.

The first design pass retained the existing left-aligned question/helper and familiar three-card structure. Existing theme tokens supply white / `#151718` backgrounds, white / `#1F1F1F` card surfaces, `#11181C` / `#ECEDEE` primary text, `#687076` / `#9BA1A6` readable secondary text, `#E5E5E5` / `#3A3A3A` borders, and `#6A4FF5` for enabled Continue. The second pass reviewed the original native Light empty and Dark Large Gym selected views: the unselected stack already worked, so the refinement concentrated on legibility, selection semantics, and the growing in-scroll action. Self-critique kept surfaces quiet and removed competing decoration; final native review accepted all ten published raw images.

The complete 3,827-byte function before its return is byte-identical to base `6ffc2364bf5203127b71829f4c527583b6063460`, with controller SHA256 `b134a14c8b04ac17e4a4827614a9ad09ab55ee80d336b51effb4094845e45119`. Restored local selection, `trainingPlace` writes, persistence, replacement and repeated taps, direct-handler empty guards, screen/entrance/checkmark/button motion, and the guarded push to `/onboarding/training-place/equipment` with its exact selected `gymType` parameter retain their behavior.

Only `app/onboarding/training-place/index.tsx` changes in production. Independent review confirms all 210 guarded shared files remain byte-identical: shared components, providers, theme, hooks, constants, API, dependencies, configuration, and adjacent screens remain unchanged. This PR adds its own harness, native flow, review document, and screenshot evidence without changing shared headers, backend code, database schema, authentication, or legal content.

</details>

<details>
<summary>Component tests and independent engineering verification</summary>

Before production edits, the actual unchanged-screen harness passed 15 behavior, motion, and own-contract cases. The final harness passes those same cases plus eight distinct presentation cases: **23/23**. Historical-screen renders are not duplicated or counted as additional coverage.

The harness loads the actual Training Place screen, OnboardingProvider, AppearanceProvider, AnimatedButton, AnimatedCheckmark, ThemedView, color/theme/transition hooks, and theme/font constants. Native rendering/animation/icons, router, Auth context, and storage boundaries are mocked. The original shared SelectableOptionCard was loaded for the baseline. Both themes cover every exact choice and route parameter, persistence, restored values, empty/direct guards, replacements, repeated taps, later context updates with local selection gating, and existing motion configurations. Presentation checks cover checked radios, hidden decoration, stable neutral paint, readable text/check contrast, enabled-only purple, and naturally growing in-scroll content. Font-setting checks verify structure rather than native glyphs or frames.

Independent verification at `/private/tmp/u23-independent-verification.UTS5eX` passes **655/655 named cases** and **656/656 standard Node results**, where the interaction-audit self-test file runner is counted once. The existing baseline contributes 633 standard results (632 named cases plus that one runner), and the 23 own screen cases are included in the final counts. Typecheck, interaction audit, audit self-test, and diff checks pass. Lint has zero errors and two inherited shared-component hook warnings in `animated-checkmark.tsx` and `hero-neon-line.tsx`; neither file changes here.

A fresh cache-cleared independent web export with `EXPO_NO_DOTENV=1` produces **62 actual HTML files**. Bundle `entry-7f726d4da40c2221aeda4ed92ad719f4.js` contains the final selectors and the unique temporary HTTPS verification URL `https://u23-independent-api.invalid`. This verifies the build, not native layout. Implementation baseline and gate logs also remain at `/private/tmp/primerep-u23-place-PwhIbp/`.

Original screen SHA256: `cbb7da89352c9ae5e013524f08556ede489a0a959de65d0da8af6c0859bf5db2`. Final production screen SHA256: `f6e48b97cf50fbbb3807a1f0e95c0fba90ef68a1efd3ad01d89d2638471e99f7`.

</details>

<details>
<summary>Native coverage, provenance, and state boundaries</summary>

Five iOS 18.5 configurations passed on the existing custom development binary, plus an additional restoration flow:

- Normal Light and Dark on iPhone 16 Plus: Large Gym prefill, actual Small Gym → Garage Gym → Large Gym replacement with exclusive checked radio states, whole question/helper/cards/action, and public Training Frequency → Training Place remount retaining Large Gym.
- Cold maximum accessibility text in Dark and Light: actual question/helper/all three titles/descriptions reached through overlapping scroll captures, actual Small Gym activation in Dark and Garage Gym activation in Light, and the complete grown Continue button above the safe area with no keyboard.
- Compact Light on the original iPhone SE guest: all three choices unchecked, every description and disabled Continue reachable, followed by public return to empty Signup without changing any choice or field.

Native radio values were asserted as checked/unchecked. The final normal hierarchy measured Large Gym 108 pt high, Small Gym 91 pt, Garage Gym 90 pt, and Continue 56 pt, each wider than 44 pt. These are native touch-frame checks, not a VoiceOver spoken traversal test.

Continue was never pressed on Training Place during native validation. There is **no native forward-route or Equipment-default initialization claim**. The component harness checks the guarded push and exact `gymType`; actual Equipment initialization was not exercised. Native persistence uses public route remounts. Equipment, Custom Split, account submission, login, Health, private-storage edits, database changes, and permission prompts were excluded.

The three BEFORE images come from unchanged base `6ffc2364bf5203127b71829f4c527583b6063460`. All seven AFTER images and the final source check match frozen SHA256 `f6e48b97cf50fbbb3807a1f0e95c0fba90ef68a1efd3ad01d89d2638471e99f7`. All ten published PNGs are unmodified byte-for-byte copies (`cmp`: **10/10**) of originals in `/private/tmp/primerep-u22-u23-u25-native-ZRoGID`; no cropping, resizing, overlays, or recreated screenshots were used. All ten images were visually reviewed and the complete provenance README was read. Private maximum-text companion captures support the detailed glyph-reach checks.

The isolated port-8083 candidate was proven by actual native screen IDs. Two initial LAN/loopback connection attempts failed while its listener was absent; a restarted server then exposed a launch-asset 404 from the external dependency symlink. Replacing only the isolated symlink with an APFS clone of the existing dependencies repaired the entry URI, with manifest and actual iOS JavaScript HTTP 200 verified before native retry. No installation, version/configuration change, app-source change, native pass, or AFTER screenshot is attributed to those failed connections. The private connection-error diagnostic is excluded from published images. The usual port-8081 server, Python port 8082, and backend were untouched.

Only the fictional 16 Plus fixture received local training-place choice changes. It finished with Large Gym checked, other choices unchecked, Light appearance, Large text, and no keyboard; its prior fictional name, reason, frequency, split, body, and 1RM draft remained unchanged. The original compact guest finished at empty Signup without field edits. An initially empty training-place choice cannot be restored through existing UI, so this is not described as blank-state restoration.

After candidate testing, both guests were reconnected through the public development-client link to the existing usual Metro on port 8081. Two cleanup-only checks passed: the fictional fixture visibly retained Large Gym on the usual server's original Training Place presentation, with Light appearance, Large text, and no keyboard; the compact guest showed empty Signup with no keyboard. No choice or field was changed during cleanup. Those private cleanup captures are excluded from the ten candidate evidence images.

No authenticated simulator, state clear, keychain reset, native rebuild, backend mutation, or permission prompt was used. Coverage is iOS Simulator only, with no Android, physical-device, VoiceOver audio, OS Reduce Motion, or native animation frame-timing claim. The shared header remains outside this screen's scope.

</details>

<details>
<summary>Independence, dependencies, and rollout</summary>

This isolated branch starts at `6ffc2364bf5203127b71829f4c527583b6063460`. Its harness guards only its own controller and content, allowing independent Training Frequency and other screen refinements to merge separately. No API changes, migrations, dependency-version changes, or special rollout are required. The user's untracked design directory and roadmap are excluded. Prepared for review; no merge performed. The ten accepted raw screenshots and provenance README are pinned to the immutable feature-and-assets commit.

</details>

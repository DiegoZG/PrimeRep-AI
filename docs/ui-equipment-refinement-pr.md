# U24 Equipment UI refinement

Equipment keeps its familiar grouped list, purple selected border/check, complete numeric weight strings, and existing Search/NEXT footer. Only this route opts into the refined shared Card presentation.

Original normal Dark on the new fictional iPhone 16 Plus:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-before-dark-initial.png" width="320" alt="Original Plus Dark Equipment initial with selected purple borders and original weight and Edit styling" />

Final cold normal Dark on the same fixture:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-dark-initial.png" width="320" alt="Final Plus Dark Equipment initial with readable secondary text, neutral independent Edit and preserved purple selection" />

The actual-screen harness passes 43 cases; independent verification passes 753 named cases and 754 standard results. Five cold iOS configurations passed. All eleven published-candidate PNGs are unedited raw copies: four genuine same-Plus BEFORE frames and seven fresh final AFTER frames.

[Screenshot provenance, measured native matrix, cleanup and reproduction](https://github.com/DiegoZG/PrimeRep-AI/blob/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/README.md)

## Changes and design review

- Expose equipment selection as a named checkbox with its actual checked state. Keep the outer Card group inaccessible so the independent Edit action is not merged into the selection node.
- Put a neutral Edit button below the weight text, aligned with the name/subtitle, with minimum 44-point targets. Preserve the original visible edit label and visibility conjunction.
- Use readable existing secondary text, named 44-point See-all actions, and safe-area-aware bottom footer padding.
- Preserve unrestricted name/subtitle/action text growth. Only the decorative initial and selected check have fixed glyph geometry; the check still uses the original AnimatedCheckmark.

The first design pass reused six existing theme roles: background `#fff` / `#151718`, surface `#fff` / `#1F1F1F`, text `#11181C` / `#ECEDEE`, readable secondary `#687076` / `#9BA1A6`, border `#E5E5E5` / `#3A3A3A`, and meaningful selected purple `#6a4ff5`. System sans typography and left alignment remain familiar. The second pass used the original native findings: Edit was merged into the Card accessibility node; cold MAX decorative initials clipped and the check glyph disappeared. Cold MAX Search/NEXT grew whole, so their layout was retained rather than redesigned.

## Preserved contracts and scope

The controller, defaults, catalog fallback, grouping, sorted selection persistence, external context synchronization, weight arrays, numeric strings, image priority, edit destinations/propagation, original animations, and enabled empty-selection NEXT route to Notifications are unchanged. No weight conversion or unit label was invented.

Shared Card defaults to the unchanged legacy presentation. Search U40 and See-all U41 remain on that branch; Settings uses its own controls and is unchanged. The opt-in branch preserves the selected purple border/check and original selection press opacity. Shared providers, Search/Button/Checkmark implementations, dependency versions, API/configuration, and backend are unchanged.

## Implementation verification

- Original provider-backed baseline: 29 passing cases. Fourteen distinct presentation cases were added before production changes: original run 29 pass / 14 fail, then final run 43 pass / 0 fail / 0 skipped. An alignment assertion within an existing new case failed in both themes before removing Edit's horizontal padding, then passed; it does not add named cases.
- Frozen original host fixture: 36 theme/selection/visibility/image variants. Omitted and explicit-false Card presentation independently match every original digest; their 72 renders are not counted as 72 tests. Callback and nested Edit propagation behavior are checked separately.
- Different-worker independent QA passes 43 focused / 753 named / 754 standard results, with zero failures/skips and the audit runner counted once. The 43 focused cases are included in 753, not added to it. Types, scoped lint with zero diagnostics, action audit/self-test, and diff checks pass. Normal Expo lint has zero errors and the two inherited hook warnings in unchanged `animated-checkmark.tsx` and `hero-neon-line.tsx`.
- Fresh independent cache-cleared, dotenv-disabled HTTPS web export produces 62 actual HTML files. Entry `entry-edb1e645f5947966525c0382b12447c1.js` has SHA256 `aac4f84ae82cf97f5ce4b8f6b1a30adb9cdff7894c7529254377540d88d04b9d` and contains the final presentation/action markers and `https://u24-independent-api.invalid`. This is build evidence, not native layout evidence.

Independent evidence is `/private/tmp/u24-independent-verify-HCIb5t/REPORT.json`; implementation/before-failure records remain at `/private/tmp/u24-implementation-verification.SVq8Zx/`. Independent comparison confirms all 617 other tracked base files unchanged. Frozen original host fixture SHA256 is `30905d209141043968e63ced85844b1e9e7398bf631fd50a5f0dafca7ac4d627`.

Original route SHA256: `f7136c4c4abb9d5e0cf53f47bd307d1b9aacc75c716c92732f3cf8637e3abc64`; final route: `806c7593ba6a85d305e1e3bc60be83cacdf7d5e99fbf0767780f53c5faf13c58`.
Original Card SHA256: `e297ae394c5732d1730eb0afc90b755ee92e5a127eca5d1123ae01834d4795e0`; final Card: `711948254f316a423a2ef4e67007f6dc5b1c3002d4dc4a9235e6d35d56e3e854`.
The original controller retains 7066 JavaScript characters / 7066 UTF-8 bytes and SHA256 `51772c8ff66357ab6da4393260b9ad111e3c06b15d60ec97f486356127b8524b`, excluding only the new presentation inset hook. Legacy returned Card JSX retains its original 1927 JavaScript characters / 1929 UTF-8 bytes and SHA256 `6ef78e14916f054988099bee4ec502c1c58c84f2f32a13c53b9bdcb67bc8bec1`, alongside all frozen host digests.

## Native evidence and known boundaries

The final five cold configurations pass on newly owned fictional fixtures only: iPhone 16 Plus Light/large, Dark/large, Light/MAX and Dark/MAX (`6048B3FD-366F-4BAD-A944-44E45A4FD9DD`), plus new iPhone SE Light/large (`DFD527A2-451F-42FF-871A-6B6F0193864A`). MAX means `accessibility-extra-extra-extra-large`; real text is uncapped. The four original frames and normal final Plus frames are genuine same-device comparisons. Compact has only an AFTER, not an invented compact BEFORE.

Native hierarchy exposes separate Dumbbells/Plates selection nodes and named Edit nodes. Crossover Cable's actual native value changed `checkbox, checked` → `checkbox, unchecked` → `checkbox, checked`, with its visual check restored. Maestro's generic `checked` field stays false even when the actual native value says checked, so it is not used as proof. Rendered code declares checkbox/button roles; the dump reports checkbox role/state through the native value and independent Edit labels/frames, not a separate raw button-trait field or VoiceOver spoken traversal.

Normal Edit Dumbbells/Plates are separately measured 44×44 targets; MAX Edit Plates is 87×75. Whole grown MAX Dumbbells Edit was reached in overlap frames, without a separate MAX frame-size claim. See all Bars and plates is 382×44 normally / 382×136 at MAX; Search is 382×46 / 382×94, and NEXT is 382×52 / 382×101. All names and full Dumbbells/Plates weight strings were reached through overlapping MAX scroll frames. Giant cards are not claimed to fit one viewport; the two published MAX footer images show only the weight tail, whole Edit/See all and whole grown Search/NEXT. Private companion captures establish the beginning and middle of each weight list. Decorative initials/check glyphs remain intact.

Supplemental native checks verified Crossover Cable OFF→ON, the actual See all Cable machines destination, main Search Equipment navigation, and observed header Back return. No dependent-route text or selection was changed. Failed selector/Back-label, YAML-direction and bounded reverse-scroll diagnostics are excluded from the five passing configurations and eleven images; they are not relabeled as app fixes. Edit and NEXT were never pressed natively. Their original callbacks/destinations remain covered by the component harness, not a native permission/forward-route claim.

This is not blanket read-only testing: Large Gym setup, existing Equipment mount/default synchronization and exactly two Cable selection actions wrote only fictional local fixture state. No existing A21/compact device received Equipment writes. No Health/notification permission, auth/account action, backend mutation, private-app-data inspection, storage/keychain edit, `clearState` or data reset was performed. UI-only reuse of the existing development binary does not certify Health integration; that binary lacks Health purpose strings. Android, physical devices, VoiceOver audio, OS Reduce Motion and native animation-frame timing are not certified.

All eleven canonical PNGs match named raw originals byte for byte and were visually reviewed: ten Plus images are 1290×2796; the new compact image is 750×1334. No crop, resize, composite or recreated screenshot was used. Original raw evidence is `/private/tmp/primerep-u24-native-baseline-w4WyeH/`; final raw evidence is `/private/tmp/primerep-u24-native-final-EI8br0/`. The accepted capture-flow SHA256 is `85b56c7ad7c8def2445b063bacb792b958050ddd6b653e612a8638543cd385d1`.

Both new fixtures completed public usual-8081 cleanup with queried Light/large settings, visibly selected Large Gym, original Equipment/default weights and no keyboard. No fixture was deleted/reset; existing devices were untouched. After that cleanup and explicit ROOT STOP, only owned Metro session 29069 received Ctrl-C and exited 0 with `Stopped server`. The owner's final process/listener proof records PID24077 absent and 8083 free, while protected 8081/8000/8082 listeners remain unchanged. Cleanup captures are restoration evidence, not AFTER artifacts.

The original Equipment toggle's cross-provider functional-update warning remains outside this visual scope. Existing WeightEditor loop/correctness and separate Core-prefill issues are not fixed or exercised. The route still writes its original gym defaults/undefined weight arrays on mount; that is why new fictional fixtures were used.

## Dependencies and rollout

Prepared independently from `10b638cb4c480ee59c0c7f07596c828dd8c91ce2`, with no U28 dependency. Scope is only the Equipment route/opt-in shared Card branch, actual-screen harness/original fixture, approved native capture flow, eleven raw screenshot copies/provenance, and this document. No API changes, migrations, dependency-version change or special rollout is required. Prepared for review; no merge. Current-main composition is a separate remaining gate; this document does not claim GitHub CI or completion of physical/Health release gates. No automatic merge is planned.

All eleven screenshots and their provenance are pinned to immutable asset commit `85d925920196294e1a5488af2e9cd5baed234ab1`.

<details>
<summary>Normal Light comparisons and original/final list-end frames</summary>

Original normal Plus Light initial:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-before-light-initial.png" width="320" alt="Original Plus Light Equipment initial with selected shortlist and original weights and Edit styling" />

Final cold normal Plus Light initial:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-light-initial.png" width="320" alt="Final Plus Light Equipment initial with readable secondary text, neutral separate Edit and preserved selected border and check" />

Original normal Plus Light actual list end:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-before-light-footer-end.png" width="320" alt="Original Plus Light actual list end showing Plates weights, Edit, See all, Search and NEXT" />

Final cold normal Plus Light actual list end:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-light-footer-end.png" width="320" alt="Final Plus Light list end with full Plates weight text, independent neutral Edit and whole unchanged footer" />

Original normal Plus Dark actual list end:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-before-dark-footer-end.png" width="320" alt="Original Plus Dark actual list end with original Edit and See all styling and whole Search and NEXT" />

Final cold normal Plus Dark actual list end:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-dark-footer-end.png" width="320" alt="Final Plus Dark list end with readable See all, separate Edit and the whole unchanged Search and NEXT footer" />

</details>

<details>
<summary>Cold MAX Light/Dark footer scope and new compact Light AFTER</summary>

Final cold Plus Light MAX weight tail/footer, not the entire giant card:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-light-max-footer-end.png" width="320" alt="Final cold Plus Light MAX weight tail with whole grown Edit and See all plus complete Search and NEXT above the home indicator; earlier weight glyphs are in private companions" />

Final cold Plus Dark MAX, with the same limited footer scope:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-dark-max-footer-end.png" width="320" alt="Final cold Plus Dark MAX weight tail and whole grown Edit, See all, Search and NEXT; this is not a whole giant-card capture" />

Final cold new SE Light actual list end; no compact BEFORE exists:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/85d925920196294e1a5488af2e9cd5baed234ab1/docs/pr-screenshots/u24/u24-after-compact-light-footer-end.png" width="320" alt="Final cold new iPhone SE Light list end with naturally wrapped Plates weights, independent Edit and whole footer; AFTER only, not a same-device before comparison" />

</details>

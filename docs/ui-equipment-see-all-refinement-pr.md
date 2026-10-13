# Refine onboarding See-all Equipment accessibility

Incremental named Search and checked-row semantics in the existing category list, retaining neutral rows and meaningful purple focus/selection. Author and independent engineering are accepted; five matched native configurations verify the scoped improvements, with shared Search's unchanged touch-area limitation disclosed below.

Dark / normal — original Cable machines, same checked fixture:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-before-dark-large-initial.png" width="320" alt="Original Dark Cable machines list with selected rows">

Dark / normal — refined, four checked rows preserved:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-dark-large-initial.png" width="320" alt="Refined Dark Cable machines with named checked rows and matching Back navigation">

<details>
<summary>Light, MAX and compact comparisons — 10 more raw images</summary>

Light / normal — original:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-before-light-large-initial.png" width="320" alt="Original Light Cable machines list">

Light / normal — refined, matched public entry:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-light-large-initial.png" width="320" alt="Refined Light Cable machines with matching original Back arrow">

Light / MAX — original:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-before-light-max-initial.png" width="320" alt="Original Light MAX Cable machines list">

Light / MAX — refined initial:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-light-max-initial.png" width="320" alt="Refined Light MAX growing equipment names and whole decorative glyphs">

Light / MAX — same configuration, scrolled lower overlap:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-light-max-lower-overlap.png" width="320" alt="Refined Light MAX whole lower Row Cable name and selected check">

Dark / MAX — original:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-before-dark-max-initial.png" width="320" alt="Original Dark MAX Cable machines list">

Dark / MAX — refined initial:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-dark-max-initial.png" width="320" alt="Refined Dark MAX Cable machines initial">

Dark / MAX — same configuration, scrolled lower overlap:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-dark-max-lower-overlap.png" width="320" alt="Refined Dark MAX whole lower Row Cable and fixed selected glyph">

Compact Light / normal — original, all four unchecked:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-before-compact-light-large-initial.png" width="320" alt="Original compact Cable machines list without injected selection">

Compact Light / normal — refined, still unchecked:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/u41-after-compact-light-large-initial.png" width="320" alt="Refined compact named unchecked Cable machines">

</details>

Twelve unedited raw copies: five genuine original initials, five final initials and two MAX scrolled companions. All final initials use the matched public Search→See-all Cable machines entry, preserving Back navigation and fixture selection. Companions are not extra configurations or a whole-giant-list/one-frame claim. [Exact provenance, hashes and reproduction](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ee8d33199e627b3fde529623a543a320ee24385f/docs/pr-screenshots/u41/README.md).

## Changes and preserved contracts

Only `app/onboarding/training-place/see-all.tsx` changes production presentation: supported Search label/selector, already-merged Card quiet opt-in, and neutral named 44-point-minimum Retry with pressed feedback. User names remain uncapped; decorative initial/check glyphs are intentionally fixed. No Edit controls, shared source, header/scroll rewrite or new API.

The 3,867-byte controller stays exact. Case-sensitive category/header params and all seven mappings, within-category name/ID filtering, sorting, image priority, fonts, purple focus/selection, animations, selected IDs/numeric arrays, draft persistence and loading/cache/fallback remain protected. Padded-query, unknown-category and context/reset synchronization quirks are not corrected.

## Engineering verification

Author and fresh independent verification pass 37 focused / 917 named / 918 standard tests. Focused cases are included; standard adds the audit self-test file runner once. Scoped lint, audits/self-tests and diff check pass; normal lint has zero errors and two inherited warnings. Types were skipped as directed: no imports/type declarations changed. Fresh cleared, dotenv-disabled HTTPS export verifies 62 actual HTML files and actual route markers.

Original baseline 31 passed, then six new presentation instances failed before production. Precisely two original presentation cases per theme—four instances—were adapted for approved label/row semantics; business assertions and omitted/default/false legacy Card coverage remain. No historical-run count inflation. Actual providers/components render with bounded native/params/navigation/Auth/storage/catalog-I/O mocks, not native account-switch certification. Shared modules and 676 other tracked author-base blobs remain unchanged.

## Native verification and remaining limits

Five fresh matched cold configurations: fictional iPhone 16 Plus Light/Dark normal and MAX, and iPhone SE3 Light normal, iOS 18.5. Actual names and native `checkbox, checked/unchecked` values agree with visual selection: four checked rows on Plus, four unchecked on compact. All four row frames were measured in every configuration: 48 points high normal/compact, 136 or 205 at MAX. Whole names and fixed initials/checks are visible across initial/lower overlaps; not physical VoiceOver or every catalog item. Generic driver checked:false is not the selection source of truth.

Shared Search is unchanged: input frames remain 19 points high normal Plus, 20 on compact and 69 at MAX. Original visual-padding tap did not focus; its larger shell is not a 44-point editable target. No shell-focus fix or every-control-44-point claim. A separate shared touch-area PR requires both U40/U41 merged first and advance user notice, preserving query/controller, purple focus, motion/theme and navigation-mode onPress.

Retry remains source/mocked-provider QA only: ordinary real errors keep fallback/cache rows; no fabricated native empty-error state or native Retry press. Existing provider/cache persistence may occur on mount, so no blanket no-storage claim. No checkbox/data injection, editor/Next/Skip/auth/Health/OS permission/API/DB/private-container/reset action was invoked.

One temporary `row` query was typed, exactly three characters erased, and empty field/closed keyboard/unchanged four checked rows verified. This succeeded on the warm diagnostic header stack before the replacement matched cold Light entry: query-only supplemental evidence, not a matched configuration/header pass or an extra case. Direct/warm-entry images without the original Back arrow and the original merged-label selector/erase rejection are excluded diagnostics, not source bugs or native product failures/passes.

Human approved temporary LAN access; existing UI-only binary/dependencies were reused without build/version/configuration changes. Both approved fictional fixtures are restored to usual 8081 First name, Light/normal, exact empty field and no keyboard. Only the owned U41 runtime was stopped normally; 8083 was verified free and protected services unchanged. No CI, physical-device/audio, release or data-correctness certification.

## Dependencies and rollout

Author base `8ff00fa1752624f82c64ace323084361eca1023e` includes merged #77/#78. Card quiet opt-in is already merged; U40 is separate, not a dependency. Published-head/current-main integration will be reported separately before review readiness. Presentation-only rollout, no schema/provider/backend change. Prepared for review; no merge.

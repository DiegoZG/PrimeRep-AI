# Refine onboarding Equipment Search accessibility

Incremental named Search and checked-row semantics, preserving the existing neutral rows and meaningful purple focus/selection. Author and independent engineering are accepted; five matched native configurations verify the scoped row improvements, with the unchanged shared Search touch-area limitation disclosed below.

Dark / normal — original, same selected/unselected fixture:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-before-dark-large-initial.png" width="320" alt="Original Dark Equipment Search with selected and unselected rows">

Dark / normal — refined, selection preserved:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-dark-large-initial.png" width="320" alt="Refined Dark Equipment Search with separately named checked and unchecked rows">

<details>
<summary>Light, MAX and compact comparisons — 10 more raw images</summary>

Light / normal — original:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-before-light-large-initial.png" width="320" alt="Original Light Equipment Search">

Light / normal — refined:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-light-large-initial.png" width="320" alt="Refined Light Equipment Search with unchanged selection">

Light / MAX — original decorative clipping/missing selected check:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-before-light-max-initial.png" width="320" alt="Original Light MAX Equipment Search with clipped initials and missing selected check">

Light / MAX — refined initial, whole decorative glyphs and growing user names:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-light-max-initial.png" width="320" alt="Refined Light MAX Equipment Search initial">

Light / MAX — same configuration, scrolled lower overlap:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-light-max-lower-overlap.png" width="320" alt="Refined Light MAX lower equipment names and whole fixed glyphs">

Dark / MAX — original:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-before-dark-max-initial.png" width="320" alt="Original Dark MAX Equipment Search with decorative defects">

Dark / MAX — refined initial:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-dark-max-initial.png" width="320" alt="Refined Dark MAX Equipment Search with whole decorative glyphs">

Dark / MAX — same configuration, scrolled lower overlap:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-dark-max-lower-overlap.png" width="320" alt="Refined Dark MAX whole lower equipment names and selected check above home">

Compact Light / normal — original unselected fixture:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-before-compact-light-large-initial.png" width="320" alt="Original compact Equipment Search with no injected selection">

Compact Light / normal — refined, still unselected:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/u40-after-compact-light-large-initial.png" width="320" alt="Refined compact Equipment Search with named unchecked rows">

</details>

Twelve unedited raw copies: five genuine original initials, five final initials and two MAX lower-overlap companions. Companions are not additional configurations or an all-catalog/one-frame claim. Plus selection is preserved; compact stays originally unselected. [Exact provenance, hashes and reproduction](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/353a45559a8370c2d5219042953ef7afcea9743e/docs/pr-screenshots/u40/README.md).

## Changes and preserved contracts

Only `app/onboarding/training-place/search-equipment.tsx` changes production presentation: supported Search label/selector, already-merged Card quiet opt-in, and neutral named 44-point-minimum Retry with pressed feedback. User names remain uncapped; decorative initial/check glyphs are intentionally fixed. No Edit controls, shared source, header/scroll rewrite or new API.

The 4,518-byte pre-return controller remains exact. Category grouping/order, name/ID/category filtering, image priority, fonts, purple focus/selection, animations, selections/numeric arrays, draft persistence, cache/fallback and raw query/context-reset quirks are preserved.

## Engineering verification

Author and fresh independent verification pass 35 focused / 915 named / 916 standard tests. Focused cases are included; standard adds the audit self-test file runner once. Scoped lint, audits/self-tests and diff check pass; normal lint has zero errors and two inherited warnings. Types were skipped as directed: no imports/type declarations changed. Fresh cleared, dotenv-disabled HTTPS export verifies 62 actual HTML files and the actual compiled route markers.

Original baseline 29 passed, then six new presentation instances failed before production. Precisely two original presentation cases per theme—four instances—were adapted for approved label/row semantics; business assertions and omitted/default/false legacy Card coverage remain. No historical-run count inflation. Actual providers/components render with bounded native/router/Auth/storage/catalog-I/O mocks, not native account-switch certification. Shared modules and 676 other tracked author-base blobs remain unchanged.

## Native verification and remaining limits

Five fresh cold configurations: fictional iPhone 16 Plus Light/Dark normal and MAX, plus iPhone SE3 Light normal, iOS 18.5. Actual names and native `checkbox, checked/unchecked` values match preserved visual selection; generic driver checked:false is not used as truth. Measured row targets are at least 44 points: normal Plus 356×48, compact 301×48, representative MAX rows 136–204 points high. Whole representative initials/checks and lower growing names are confirmed across initial/scrolled overlaps, not every catalog item or physical VoiceOver.

Shared Search is unchanged: input frames remain 19 points high on normal Plus, 20 on compact and 69 at MAX. A previously observed visual-padding tap did not focus. Its larger shell is not a 44-point editable target; this PR does not fix shell-tap focus or certify every control. A separate shared touch-area PR requires both U40/U41 merged first and advance user notice, preserving controller, purple focus, motion/theme and navigation-mode onPress.

Retry remains source/mocked-provider QA only: real ordinary errors keep cache/fallback rows, so no native empty-error fixture or native Retry pass is invented. One temporary `loop` query was typed, exactly four characters erased, and the restored empty field/closed keyboard/unchanged selection verified without toggling or submitting; not a sixth configuration. Existing provider selection/cache persistence may occur on mount, so this is not a blanket no-storage claim.

Human approved temporary LAN development access. The owned U40 runtime was stopped normally; protected services were unchanged. Final fictional-fixture restoration is intentionally deferred to separately authorized U41 completion, not claimed complete here. Existing UI-only development binary: no new build, dependency/version/configuration change, auth/editor/Next/Health/OS permission or API/DB mutation invoked; no CI, physical-device/audio, release or data-correctness certification.

## Dependencies and rollout

Author base `8ff00fa1752624f82c64ace323084361eca1023e` includes merged #77/#78. Card quiet opt-in is already merged; U41 is separate, not a dependency. Published-head/current-main integration will be reported separately before review readiness. Presentation-only rollout, no schema/provider/backend change. Prepared for review; no merge.

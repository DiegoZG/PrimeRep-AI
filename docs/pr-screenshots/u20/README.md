# U20 · Fitness Goal native evidence

Five native configurations passed in the existing iOS18.5 development build. Every published AFTER uses `fitness-goal.tsx` SHA-256 `68897c2c6e4d12146d928151090dbd291eb5e5674a1b9cfb3b9d663c6072e26d`, checked before each configuration. The three published BEFORE originals are from the untouched screen on base `9f2811810329482b6871f11558f3e23c1bc1e65b`, baseline source SHA-256 `bcbaf5fa74a9bac4b39acb07b694d57445124b49aa1fd5e22b6acb20cee241d1`.

## Actual native coverage

| Configuration | Verified result |
| --- | --- |
| 16 Plus, Light, standard `large` text | Press Build Muscle then General Fitness; native radio checked state changes; actual whole last card and Continue reached; Continue → Training Frequency(5/9); public return retains General Fitness checked and Build Muscle unchecked. |
| 16 Plus, Dark, standard text | Press Conditioning then Get Stronger; same replacement, whole last-card/footer, route and returned-choice checks. Together normal flows press all four choices. |
| 16 Plus, Light, maximum accessibility text | Cold launch, real scroll reaches every title, helper, Popular/Powerlifting tag and full enlarged Continue. Actual glyphs reviewed across overlapping private companion PNGs. Layout only; no max route claim. |
| 16 Plus, Dark, maximum accessibility text | Same cold-launch actual-scroll/glyph/footer coverage. |
| SE, Light, standard text | Read-only original empty guest: all four radios genuinely unchecked, full Continue disabled, no choices written; returned to empty Signup. |

iOS encodes radio state as `value/text=radio button, checked|unchecked`; the flow uses that actual native encoding rather than an unsupported generic checked matcher. Normal card press frames are126–157pt high and Continue is56pt; the small decorative check is not the press target or a spoken check glyph. Native grouping includes title, helper and original tag copy. Neutral fills, border/check state and both tag labels were visually inspected.

Continue is in the ScrollView. Normal top captures show the initial viewport, not full-footer proof; normal bottom captures show the entire control with safe-area space. Maximum Continue grows naturally to approximately103pt (observed771–874pt) and is fully visible above the home indicator. Large cards can exceed one viewport; text is uncapped and reachable through scrolling rather than shown all at once.

## Provenance and limits

Raw originals are retained under `/private/tmp/primerep-u20-u21-native-rStu8a`; published copies are unchanged PNGs. The cross-screen baseline phase has six verified originals, not seven. Private `u20-before-light-selected.png` was mislabeled: full-resolution audit showed new neutral tags/checks and Continue. It is excluded from all published BEFORE evidence. Goal source mtime16:19:16 preceded that capture16:19:44, while verified original Dark selected was16:17:24; the exact runtime revision of the contaminated image is not proven. No baseline was reconstructed, cropped or edited.

One failed strict100% helper visibility attempt is excluded from pass counts. The Build Muscle card is1112pt and its helper703–704pt against an835pt viewport; default large gesture steps skipped an alignment window. Bounded real drags exposed the whole helper, then helper detection/centering plus overlapping companion captures verified the text. Continue remains a strict100% visibility check followed by actual visual inspection. Only the test flow changed; no production fix or font cap was introduced for this tooling retry.

Shared cyan Skip remains outside U20 scope and visibly enlarges/clips in the unchanged native header at maximum text. This is not a claim that every app header is maximum-text ready. Cold launches avoid previously observed warm font-metric mixing, without clearing state; live OS font reconfiguration is not certified. Android, physical devices, VoiceOver audio and altered Reduce Motion were not tested.

Only dedicated fictional guest `A21DA251-8A4F-45E3-8E6D-763EDD2277D3` changed its own local goal, finishing with Get Stronger; it is not claimed restored empty. Display is restored Light/standard `large`, keyboard closed. Fictional name, reason, experience and prior1RM values were not changed by U20; Body Stats fields/units were not touched. Original compact guest `67BF52B6-AC88-4620-841C-2970B1D5AF0D` is back at empty Signup. No account submission, authenticated-device access, Health, backend/DB, credential reset, dependencies/configuration or native rebuild occurred.

## Published originals

| File | State |
| --- | --- |
| `u20-before-light-initial.png` | Original empty choice, Light. |
| `u20-before-dark-initial.png` | Original empty choice, Dark. |
| `u20-before-dark-selected.png` | Original Build Muscle selected, Dark. |
| `u20-after-light-selected.png` | Final General Fitness selected, actual top. |
| `u20-after-dark-selected.png` | Final Get Stronger selected, actual top. |
| `u20-after-light-bottom.png` | Final normal last card and entire Continue, Light. |
| `u20-after-dark-bottom.png` | Same final normal proof, Dark. |
| `u20-after-light-max-bottom.png` | Final maximum helper tail and full Continue, Light. |
| `u20-after-dark-max-bottom.png` | Same final maximum proof, Dark. |
| `u20-after-compact-light-disabled.png` | Final read-only empty/disabled state on SE. |

## Reproduction

Open the public `primerepai://onboarding/fitness-goal` route in the existing `com.diegozegarra.primerep` native build. Required environment values have no YAML defaults that shadow command-line values. The output directory must already exist.

```sh
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test \
  -e MODE=full -e FIRST_CHOICE=build-muscle -e LAST_CHOICE=general-fitness \
  -e SCREENSHOT_PREFIX=/private/tmp/primerep-u20-u21-native-rStu8a/reproduce-light \
  .maestro/fitness-goal-refinement.yaml
```

Dark full mode uses `FIRST_CHOICE=conditioning` and `LAST_CHOICE=get-stronger`. Maximum layout uses `MODE=layout` after selecting OS maximum accessibility text and a normal cold app launch, without resets. Read-only compact uses `MODE=empty` only on an original guest whose goal is actually empty; it navigates back to Signup. No account/Health workflow is part of this flow.

# U19 · One-rep max native evidence

Five final-source native configurations passed on iOS 18.5. Every published AFTER is from screen SHA-256 `b829b84d1e31b5ac37b6e0121a437f5cd532c4ac9bfd41954c75b6fb597cd273`; BEFORE originals were captured before U19 implementation. Screenshots are unchanged simulator PNGs, not composites or renders.

Use the existing iOS 18.5 `com.diegozegarra.primerep` native development build with Metro. The 16 Plus fixture (`A21DA251-8A4F-45E3-8E6D-763EDD2277D3`) contains fictional guest onboarding data; its local strength values and unit may change through actual UI controls. Original guest simulators remain untouched except optional read-only compact navigation, followed by restoration to empty Signup. No accounts, backend records, workout/Health data, credentials, native build, dependencies, configuration, or shared source are changed by this verification.

## Verified coverage

| Configuration | Checks |
| --- | --- |
| 16 Plus, Light, standard text | Entered-state capture; focus Deadlift 315; real numeric-keyboard marker visible; entire Continue above keyboard; one tap → Goal, keyboard gone; public return retains 315. |
| 16 Plus, Dark, standard text | Same focused keyboard, first-tap route and returned-value case, with fresh entered-state capture. |
| 16 Plus, Light, maximum accessibility text | Cold launch; actual scroll reaches calculator, LB/KG and all three individual inputs/labels/unit suffixes; actual enlarged glyphs inspected; entire readable Continue; keyboard absent. Layout only. |
| 16 Plus, Dark, maximum accessibility text | Same cold-launch layout and actual glyph checks. |
| SE, Light, standard text | Read-only three blank `-` placeholders and enabled optional Continue; returned to original empty Signup without focus, typing, unit or calculator changes. |

Additional actual Light UI checks were completed before the final responder-only correction: entry of 100/225/315 lb, LB → KG → LB yielding 45.4/102.1/142.9 kg then 100.1/225.1/315 lb, and background/on-drag keyboard dismissal on predecessor `0d106215d984e7653a2cc6ed6932be768cebec3fc532f597bf85c4066c688576`. Calculator cancel preserved values and the real 5 reps × 100.5 lb → 113 lb Bench Press estimate was calculated/applied on predecessor `ce9c0bc8b28089eb5351c4fbf4984d3a192d6b6a28ebba49aacdd5702c4a9e67`. Controller and calculator source remain unchanged; these are not claimed as complete final-hash math/modal reruns. No body-weight fixture was introduced.

Native verification exposed two local layout issues and verified their corrections: the initial in-scroll footer was covered by the keyboard; the subsequent outer dismiss responder prevented maximum-text scrolling. Final Continue is an in-flow sibling below the ScrollView inside the existing keyboard-avoiding layout, and the existing dismiss wrapper surrounds only content inside the ScrollView. Final Light/Dark first-tap and maximum-scroll cases passed after these corrections.

Retries are excluded from pass counts: one keyboard-covered field tap typed into the previously focused field, and a later calculator modal rendered correctly while Maestro returned an empty accessibility hierarchy. The visible Cancel control was used through observed native coordinates. Warm OS font changes also produced mixed metrics and an unintended restored input focus; final maximum captures use cold launches with no keyboard. This does not establish a general live-font-resize fix or a conclusive cause for mixed metrics. Failed/intermediate diagnostics remain private and are not published.

## Reproduction

Start on One-rep Max using the dedicated fictional guest. Required parameters have no YAML defaults that shadow command-line values.

```sh
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test \
  -e MODE=keyboard \
  -e SCREENSHOT_PREFIX=/private/tmp/u19-one-rep-max-light \
  .maestro/one-rep-max-refinement.yaml
```

Final focused normal cases use `MODE=keyboard` with the fixture's existing Deadlift 315. Maximum-text checks use `MODE=layout` after setting OS maximum accessibility text and a normal app cold launch, with a distinct output prefix. Layout mode does not claim route or conversion coverage. `MODE=full` is the extended entry/conversion/modal case and additionally requires `CALCULATOR_MODE=apply|cancel`; it was not counted as a complete final-source pass. Required environment values have no defaults that shadow command-line overrides. Maximum-text evidence is from the 16 Plus, not the SE.

## Published originals

| File | Genuine state |
| --- | --- |
| `u19-before-light-initial.png` | Original optional empty fields, Light. |
| `u19-before-light-entered.png` | Original fictional 100 lb entry, Light. |
| `u19-before-dark-keyboard.png` | Original NEXT above the real numeric keyboard, Dark. |
| `u19-after-light-entered.png` | Final 100.1/225.1/315 lb, Light. |
| `u19-after-dark-entered.png` | Same final values, Dark. |
| `u19-after-light-keyboard.png` | Final full Continue above real keyboard, Light. |
| `u19-after-dark-keyboard.png` | Same final keyboard/footer proof, Dark. |
| `u19-after-light-max-bottom.png` | Final maximum-text lower fields and full Continue, Light. |
| `u19-after-dark-max-bottom.png` | Same final maximum-text layout, Dark. |
| `u19-after-compact-light-blank.png` | Final read-only optional blank fields on SE. |

The dedicated fixture's own fictional values remain 100.1/225.1/315 lb, Advanced experience and its existing reason; display settings are restored to Light/standard `large`. Original compact guest is back at empty Signup. No guest state or credentials were cleared. Raw originals and failed diagnostics are retained under `/private/tmp/primerep-u17-u19-native-2Pu8Yb`.

Reduce Motion is unchanged. Android, VoiceOver audio, and body-weight conversion through a separately populated body-stats fixture are outside this native matrix; existing controller/unit checks cover the preserved logic.

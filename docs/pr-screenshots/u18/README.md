# U18 · Fitness experience native evidence

Five native configurations passed on iOS 18.5 using the existing `com.diegozegarra.primerep` development build and Metro. BEFORE and AFTER PNGs are unmodified simulator captures. All AFTER checks used frozen source SHA-256 `84d594492fd62abc5fea70354fce2bb7f4d43c3fe23e89a23d4bd6c904eac1fd`.

The dedicated 16 Plus fixture (`A21DA251-8A4F-45E3-8E6D-763EDD2277D3`) contains fictional guest onboarding choices. Only its local experience selection changed; its fictional bench value remained 100 lb and its structured-plan reason remained unchanged. It returned to Light/standard text with Advanced selected. The SE guest (`67BF52B6-AC88-4620-841C-2970B1D5AF0D`) supplied read-only compact evidence and returned to its original empty Signup screen; no option was pressed there. No account, backend, workout, Health, credential, build, dependency, configuration, or shared-component changes were made by this verification.

## Verified coverage

| Configuration | Checks |
| --- | --- |
| 16 Plus, Light, standard text | Passed No Experience → Fitness Goal and Intermediate → one-rep max; returning to Experience retained each selected choice. |
| 16 Plus, Dark, standard text | Passed Beginner → Fitness Goal and Advanced → one-rep max; returning to Experience retained each selected choice. |
| 16 Plus, Light, maximum accessibility text | Passed actual No Experience → Advanced replacement and native radio values; entire Continue control 100% visible, with full readable label and padding visually inspected. Layout only. |
| 16 Plus, Dark, maximum accessibility text | Same layout and visual checks. |
| SE, Light, standard text | Passed read-only empty/disabled layout and return to original empty Signup, without pressing an option. |

Maximum-text evidence uses the 16 Plus, not the SE. Native radio state is matched through its actual iOS value text, `radio button, checked` / `radio button, unchecked`. Oversized cards use centering and 10% visible area for actual presses; Continue requires 100% visibility. Layout mode does not claim route coverage.

## Evidence files

| File | State |
| --- | --- |
| [u18-before-light-initial.png](u18-before-light-initial.png) | Original Light screen with no experience selected. |
| [u18-before-light-selected.png](u18-before-light-selected.png) | Original Light, Intermediate selected. |
| [u18-before-dark-selected.png](u18-before-dark-selected.png) | Original Dark, Intermediate selected. |
| [u18-after-light-selected.png](u18-after-light-selected.png) | Refined Light, Intermediate selected. |
| [u18-after-dark-selected.png](u18-after-dark-selected.png) | Refined Dark, Advanced selected during the four-path native check. |
| [u18-after-light-bottom.png](u18-after-light-bottom.png) | Light lower options and enabled Continue. |
| [u18-after-dark-bottom.png](u18-after-dark-bottom.png) | Dark lower options and enabled Continue. |
| [u18-after-light-max-bottom.png](u18-after-light-max-bottom.png) | Maximum-text Light, Advanced selected and readable Continue. |
| [u18-after-dark-max-bottom.png](u18-after-dark-max-bottom.png) | Maximum-text Dark, Advanced selected and readable Continue. |
| [u18-after-compact-light-disabled.png](u18-after-compact-light-disabled.png) | SE empty choice state and neutral disabled Continue. |

## Reproduction

Start on Fitness Experience using the fictional guest fixture. The flow does not launch or reset the app. All parameters are required; there are no YAML defaults that shadow command-line values.

```sh
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test \
  -e MODE=full \
  -e STARTER_CHOICE=no-experience \
  -e EXPERIENCED_CHOICE=intermediate \
  -e SCREENSHOT_PREFIX=/private/tmp/u18-fitness-experience-light \
  .maestro/fitness-experience-refinement.yaml
```

For the Dark full flow, use `STARTER_CHOICE=beginner` and `EXPERIENCED_CHOICE=advanced`. Maximum-text checks use `MODE=layout` and `EXPERIENCED_CHOICE=advanced`, with a distinct output prefix.

After restoring OS text size from maximum to standard, the mounted screen retained large geometry until remounted through public routes. A screenshot-only Dark recapture navigated to the existing one-rep-max route and back. Downward gestures restored the actual top scroll position before the final capture because native visibility percentages do not account for the shared header overlay. This did not rerun or alter the already-passed routing matrix.

Android and VoiceOver audio were not tested. Reduce Motion was not changed. The shared onboarding header and inherited very large accessibility text remain separate limitations: headings and cards are scrollable rather than forced into one viewport. No global text cap or header change was introduced by this verification.

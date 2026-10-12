# U17 · First reason native evidence

Captured on iOS 18.5 using the existing `com.diegozegarra.primerep` native development build and Metro. PNGs are unmodified simulator screenshots, not web renders or reconstructed UI.

The iPhone 16 Plus fixture (`A21DA251-8A4F-45E3-8E6D-763EDD2277D3`) contains fictional guest onboarding data. Only its local reason choice changed during interaction checks. The iPhone SE guest (`67BF52B6-AC88-4620-841C-2970B1D5AF0D`) supplied read-only compact layout evidence and returned to its original empty Signup screen. No accounts, backend records, workout data, Health data, credentials, dependencies, native builds, or configuration changed.

## Verification

| Configuration | Coverage |
| --- | --- |
| 16 Plus, Light, standard text | Beginner checked; replacement choice checked and previous choice unchecked; last choice selected; Continue fully visible and enabled; Body Stats route; return retains selection. |
| 16 Plus, Dark, standard text | Same complete interaction and navigation checks. |
| 16 Plus, Light, maximum accessibility text | Layout check: actual visible card taps and native checked states; last choice selected; enabled Continue 100% visible with complete readable label and padding. |
| 16 Plus, Dark, maximum accessibility text | Same layout and visual checks. |
| SE, Light, standard text | Empty initial screen and bottom layout; no checked choice; neutral disabled Continue; return to empty Signup. No option pressed. |

Five configurations passed: two normal-theme full flows, two maximum-text layout checks, and one compact read-only check. Maximum-text evidence is from the **16 Plus**, not the SE. It checks scrolling, option activation, and footer reachability; navigation at maximum text is not claimed. Normal-theme flows verify the unchanged `Continue → /onboarding/body-stats` route and saved local selection. Reduce Motion was not changed. The fixture returned to Light/standard text, retaining its fictional structured-plan reason choice.

Normal and compact captures used predecessor source SHA-256 `589a9e3413a1b08da3070f0c1aa94ca72dee32588cf362417457d7e058475a43` and precede the final footer-only natural-growth correction. Both maximum-text captures were rerun and visually inspected against final source SHA-256 `945ce786db3b932c0a278fd655720d0d25d85d027b5e32674baab8ea2d8fc653`; no further production edits occurred during those checks.

## Evidence files

| File | State |
| --- | --- |
| [u17-before-light-initial.png](u17-before-light-initial.png) | Original Light screen with no reason selected. |
| [u17-before-light-selected.png](u17-before-light-selected.png) | Original Light screen with beginner selected. |
| [u17-before-dark-selected.png](u17-before-dark-selected.png) | Original Dark screen with beginner selected. |
| [u17-after-light-selected.png](u17-after-light-selected.png) | Refined Light screen with beginner selected. |
| [u17-after-dark-selected.png](u17-after-dark-selected.png) | Refined Dark screen with beginner selected. |
| [u17-after-light-bottom.png](u17-after-light-bottom.png) | Light last choice selected and enabled Continue. |
| [u17-after-dark-bottom.png](u17-after-dark-bottom.png) | Dark last choice selected and enabled Continue. |
| [u17-after-compact-light-disabled.png](u17-after-compact-light-disabled.png) | SE empty choice state, all lower options and neutral disabled Continue. |
| [u17-after-light-max-bottom.png](u17-after-light-max-bottom.png) | Maximum-text Light last choice and footer. |
| [u17-after-dark-max-bottom.png](u17-after-dark-max-bottom.png) | Maximum-text Dark last choice and footer. |

## Reproduction

Use the dedicated fictional guest fixture with an already-open Reason screen. The flow intentionally does not launch or reset the app. Both parameters are required; use `MODE=full` for normal-theme interactions or `MODE=layout` for maximum-text layout checks.

```sh
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test \
  -e MODE=full \
  -e SCREENSHOT_PREFIX=/private/tmp/u17-first-reason-light \
  .maestro/first-reason-refinement.yaml
```

The iOS tree exposes React Native radio state as the value text `radio button, checked` / `radio button, unchecked`; assertions use that actual representation with the stable option ID. Oversized cards use 10% visibility with centering before an actual native press, while Continue requires 100% visibility. Initial attempts with Maestro's `checked: true` property and YAML defaults shadowing CLI parameters were tooling corrections, not app failures.

## Limits

The inherited cyan Skip action and pre-existing maximum-text shared-header limitations are outside U17's screen-local changes. Maximum accessibility text still creates very large scrollable headings and cards. An intermediate U17 capture exposed a clipped Continue label; the corrected control grows naturally and its complete label is visible in both final maximum-text screenshots. Android and VoiceOver audio were not tested.

# Make Variety options announce their names and selection correctly

Variety’s three choices now expose their title and description as one clear label, identify themselves as radio options, and announce whether they are checked. The decorative checkmark is no longer part of the option’s label. The screen looks and behaves as before.

## Screenshots

Five matched original/final initial configurations were inspected on the iPhone 16 Plus and compact iPhone SE simulators. All ten initial screenshots show the same unset choice; layout, coloring and typography are unchanged.

| Configuration | Before | After |
| --- | --- | --- |
| Plus · Light | ![Original Variety, Plus Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-before-plus-light-large.png) | ![Updated Variety, Plus Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-after-plus-light-large.png) |
| Plus · Dark | ![Original Variety, Plus Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-before-plus-dark-large.png) | ![Updated Variety, Plus Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-after-plus-dark-large.png) |
| Compact · Light | ![Original Variety, compact Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-before-compact-light-large.png) | ![Updated Variety, compact Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-after-compact-light-large.png) |
| Plus · Largest text, Light | ![Original Variety, largest text Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-before-plus-light-max.png) | ![Updated Variety, largest text Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-after-plus-light-max.png) |
| Plus · Largest text, Dark | ![Original Variety, largest text Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-before-plus-dark-max.png) | ![Updated Variety, largest text Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-after-plus-dark-max.png) |

Existing selection appearance after the third native tap (Varied selected), not an extra matched configuration:

![Variety with Varied selected](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/u50-after-plus-light-selected-varied.png)

All eleven PNGs are unedited. Largest-text initial options are below the fold; partial native inventories verified their full names and state, not whole-card fit. The inherited oversized question and clipped Skip header remain unchanged and need a separate adaptive-layout follow-up. [Native evidence and limits](https://github.com/DiegoZG/PrimeRep-AI/blob/f8bc286673ad89b0341e32525d1e0cf393d37f1c/docs/screenshots/ui-variety-accessibility/README.md).

## Scope

- The shared `SelectableOptionCard` accepts five optional, typed native accessibility/test props and forwards them onto its existing `TouchableOpacity`. No wrapper or second action is added. Omitting these props preserves the original host props and presentation.
- Variety opts in with its existing `isSelected`: exact title plus description, `radio` role, checked state, and stable `variety-option-{id}` test IDs.
- Both native `accessibilityState.checked` and the supported `aria-checked` alias receive the same selection value. Installed React Native Web does not emit checked markup from the state object alone; the alias makes its actual radio markup truthful without adding keyboard handlers or changing existing tab behavior.
- Selection handlers, draft persistence, restored choices, Next gating/destination, animations, styles, colors, option copy and visible checkmarks remain unchanged. Other onboarding screens and existing tests are untouched. This is not a visual restyle.

No API, database, permission, Health, provider, environment, dependency or migration changes are included. Work was prepared in a standalone clone from merged main `a2e1a3788420585e74e35a7286f4e79a7512aee7`; the normal user checkout was not changed.

## Verification

- 19 focused cases pass using the actual Variety screen, Card, Checkmark and OnboardingProvider with explicit in-memory/native test boundaries. They cover all three labels, unchecked/checked transitions, replacement and repeated selection, restored drafts, remounts, existing Next behavior, both themes, equivalent screen/motion/default-card presentation and unchanged source contracts.
- 196 existing onboarding regression cases pass without edits.
- The author’s full standard suite passes 993 named cases plus one audit-file wrapper: 994 total, zero failures or skips. Focused and onboarding subsets are included in that total; fixture loops are not extra cases.
- Independent engineering verification and quality review accept the frozen implementation, including the 19 focused cases, type checks, interaction audits and fresh web export.
- A separate combined Profile/Variety verification snapshot passes 46 focused cases and 1,002 named cases plus one audit-file wrapper (1,003 total), typecheck, lint, interaction audits and a fresh 62-route web export. Its actual emitted Profile, Variety and Card modules match both frozen changes. The two PR scopes do not conflict; these combined counts are not added to either individual suite total.
- Typecheck, scoped lint, normal lint, interaction audit/self-test and `git diff --check` pass. Normal lint retains only the two inherited effect-dependency warnings in `animated-checkmark.tsx:34` and `hero-neon-line.tsx:60`.
- A fresh, clear, dotenv-disabled HTTPS web export produces 62 HTML routes. The actual emitted Variety module contains the full label and equivalent checked values; the Card module retains its original press handler/opacity and forwards the optional props. Actual installed React Native Web SSR verifies both checked states, one labeled radio and the existing tabbable host, plus unchanged default Card markup. SSR is not browser interaction certification.
- All 721 tracked base files outside the two production files remain byte-identical. Variety’s 3,756-byte controller stays exact, and shared default-card variants retain identical host trees. The original-source baseline’s 13 expected missing-contract failures are historical evidence, not final passes.
- Native review accepts the five matched initial configurations, four option taps (Consistent → Balanced → Varied → Varied) and one cold persistence restart. Complete native names omit the decorative check; initial values are `radio button, unchecked`, and each tap exposes one checked radio and two unchecked radios with Next enabled. Native encoded values—not generic driver checked/selected flags—are the state evidence. The restart retains Varied as the sole checked choice. No native Next action or destination was tested.

## Remaining gate and rollout

The reviewed implementation and native evidence are committed; published-head/current-main review and immutable screenshot-link checks remain pending before review readiness. Native rendering/state inventories do not certify spoken VoiceOver, a physical iPhone, browser keyboard interactions, whole-largest-text usability or GitHub CI/platform release gates. Next routing is covered by engineering tests, not a native Next tap.

At the completed cleanup checkpoint, the authorized candidate Expo server was stopped, port 8083 was free, and the usual services/isolated fixture API were unchanged. Both fictional simulators were restored to the usual guest server in Light mode and normal text size, with an empty first-name field and no keyboard. The deliberately selected Varied draft on Plus and unset choice on SE were preserved without a reset. No regular account/database or private Health data was used. This independent PR may be reviewed separately from the Profile correction; neither PR is automatically merged.

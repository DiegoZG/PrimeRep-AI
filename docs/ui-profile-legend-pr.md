# Clarify Profile activity and reveal the current-week outline

The training-rhythm legend now says “Filled: one or more completed workouts · Outline: this week.” It describes weekly activity without suggesting each filled week represents exactly one workout. A completed current week uses the theme’s primary text color for its existing outline so the outline remains visible against the purple fill; empty current weeks retain the purple outline.

## Screenshots

Five matched original/final configurations were inspected on the iPhone 16 Plus and compact iPhone SE simulators, using the same isolated fictional account and real API dataset. All ten screenshots are unedited.

| Configuration | Before | After |
| --- | --- | --- |
| Plus · Light | ![Original Profile, Plus Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-before-plus-light-large.png) | ![Updated Profile, Plus Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-after-plus-light-large.png) |
| Plus · Dark | ![Original Profile, Plus Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-before-plus-dark-large.png) | ![Updated Profile, Plus Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-after-plus-dark-large.png) |
| Compact · Light | ![Original Profile, compact Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-before-compact-light-large.png) | ![Updated Profile, compact Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-after-compact-light-large.png) |
| Plus · Largest text, Light | ![Original Profile legend, largest text Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-before-plus-light-max.png) | ![Updated Profile legend, largest text Light](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-after-plus-light-max.png) |
| Plus · Largest text, Dark | ![Original Profile legend, largest text Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-before-plus-dark-max.png) | ![Updated Profile legend, largest text Dark](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/u45-after-plus-dark-max.png) |

Largest-text frames are scrolled legend-focused windows, not whole-screen fit claims. The helper wraps naturally to two lines on the compact screen and three at the largest text size. [Native evidence and limits](https://github.com/DiegoZG/PrimeRep-AI/blob/f48d1c2f23a9fbc08d2fd6e7c4941ae79cbf36e9/docs/screenshots/ui-profile-legend/README.md).

## Scope

One legend literal and one current-week border-color expression change in the Profile route. Only a current week with a positive completed-workout count receives a contrasting theme-text outline. Purple fills, empty-week outlines, 27-point cell geometry, outline width, exact accessible workout counts, metrics/unknown states, adaptive layout, navigation, providers, and side effects are unchanged. There is no Profile restyle or new feature.

A new nine-case harness renders the actual screen and shared text/Profile components with explicit in-memory context/resource/native boundaries. It covers zero, one, and multiple completions; the contrasting completed-current-week outline and unchanged empty-week outline; both themes; uncapped text/adaptive layouts; missing achievements; and existing destinations. Reversing exactly the two approved source replacements restores the entire original Profile file. Existing Profile business tests remain byte-identical.

## Verification

- Updated author focused checks pass 27 actual cases: nine actual-screen cases plus 18 unchanged Profile business cases.
- The newly executed full standard suite passes 983 named cases plus one audit-file wrapper (984 total), with zero failures or skips. Focused cases are included, not added to this total.
- Scoped and normal lint, interaction audit/self-test, whitespace checks and a fresh dotenv-disabled HTTPS web export with 62 HTML files pass. Normal lint has only the two inherited Checkmark/hero effect-dependency warnings.
- Typecheck is intentionally skipped for the standalone Profile change because neither replacement touches imports or types. Independent engineering verification and quality review accept the frozen legend and border-color correction.
- A separate combined Profile/Variety snapshot passes 46 focused cases and 1,002 named cases plus one audit-file wrapper (1,003 total), typecheck, lint, interaction audits and a fresh 62-route web export. Its actual emitted Profile, Variety and Card modules match both frozen changes. These combined counts are not added to the standalone Profile total; the separate PR scopes do not conflict.

- Native review accepts all five matched configurations. The actual 12-week inventory and accessible counts match the isolated API before and after; the completed current week retains its purple fill with a visible light/dark outline. Native coverage uses a positive-count current week; the empty-current-week branch is covered by engineering tests, not a fabricated native fixture.

The earlier literal-only report is historical; the updated run verifies both corrections against merged main `a2e1a3788420585e74e35a7286f4e79a7512aee7`.

## Remaining gate and rollout

At the Profile cleanup checkpoint, the authorized original/final Expo servers were stopped and port 8083 was free; the usual development services and isolated fixture API were unchanged. Fictional-account logout cleanup is a separately owned handoff, not a claimed preference reset. No regular account/database or Health data was used.

The reviewed implementation and native evidence are committed; published-head/current-main review and immutable screenshot-link checks remain pending before review readiness. Physical VoiceOver, browser interactions, GitHub CI and platform/release gates are not certified by these checks. This independent PR adds no service/API/database/provider behavior or shared-component/dependency change; it is not automatically merged.

# Refine first-name onboarding and keyboard navigation

Calmer first-name entry, individually named controls, and growing footer actions in one keyboard-aware scroll, preserving name validation, draft storage, routes and animation timing. Five fresh native configurations and final independent engineering verification pass.

Dark / normal text — original, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-before-dark-large-keyboard.png" width="320" alt="Original Dark first-name screen with keyboard">

Dark / normal text — refined, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-dark-large-keyboard.png" width="320" alt="Refined Dark first-name screen with separate growing actions and keyboard">

<details>
<summary>Light, MAX and compact comparisons — 10 more raw images</summary>

Light / normal — original, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-before-light-large-keyboard.png" width="320" alt="Original Light first-name screen with keyboard">

Light / normal — refined, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-light-large-keyboard.png" width="320" alt="Refined Light first-name screen with keyboard">

Light / MAX — original, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-before-light-max-keyboard.png" width="320" alt="Original Light MAX first-name screen and clipped fixed header Skip">

Light / MAX — refined, autofocus/keyboard viewport:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-light-max-keyboard.png" width="320" alt="Refined Light MAX first-name field with keyboard">

Light / MAX — same cold entry, scrolled whole footer, keyboard dismissed:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-light-max-footer.png" width="320" alt="Refined Light MAX whole Next Skip account prompt and Log in above the home indicator">

Dark / MAX — original, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-before-dark-max-keyboard.png" width="320" alt="Original Dark MAX first-name screen and clipped fixed header Skip">

Dark / MAX — refined, autofocus/keyboard viewport:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-dark-max-keyboard.png" width="320" alt="Refined Dark MAX first-name field with keyboard">

Dark / MAX — same cold entry, scrolled whole footer, keyboard dismissed:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-dark-max-footer.png" width="320" alt="Refined Dark MAX whole Next Skip account prompt and Log in above the home indicator">

iPhone SE3 / Light normal — original, keyboard open:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-before-compact-light-large-keyboard.png" width="320" alt="Original compact first-name screen with keyboard">

iPhone SE3 / Light normal — refined, initial keyboard viewport:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/u39-after-compact-light-large-keyboard.png" width="320" alt="Refined compact first-name field with keyboard; whole form is reachable after a public drag">

</details>

All 12 images are unedited raw copies: five genuine original BEFOREs and seven fresh final-source AFTERs. MAX footer companions are scrolled, keyboard-dismissed overlaps of the same cold configurations, not extra configurations or proof the giant form fits one frame. Compact's whole form is verified in a separate private overlap after one drag. [Exact provenance and reproduction notes](https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/bc78bc83dca63ce3adce8d94c2d703ed1ad34357/docs/pr-screenshots/u39/README.md).

## Changes

- Only `app/onboarding/index.tsx` changes production presentation: existing neutral Input opt-in, named field/actions, and a non-merging dismiss wrapper around only question/input.
- All actions share a bounded inset-aware keyboard scroll. Next grows from a 56-point minimum; neutral Skip/Login grow from 44-point minima, with pressed feedback and a naturally wrapping account prompt.
- Replace only this screen's fixed header Skip with growing footer Skip. Its same literal `router.push("/onboarding/final")` does not save or change the entered name.

System 32/600 question, literal copy/hint, capitalization/content type, autofocus, focus/entrance timing, trim validation, existing-account Next behavior and routes remain unchanged. Shared Input, styles, providers, onboarding layout and motion modules are unchanged. No font caps, new feature, API, permission or auth change.

## Verification

- Author and fresh independent final-source QA: 43 focused tests, included in 790 named; standard 791 passes, adding the audit self-test file runner once.
- Types, scoped lint, action audit/self-tests and diff check pass. Normal lint: zero errors, two inherited warnings in unchanged animated-checkmark/hero-neon-line.
- Fresh cache-cleared, dotenv-disabled HTTPS export: 62 actual HTML files; actual first-name bundle contains all five selectors, neutral Input opt-in, keyboard/inset behavior and bounded scroll. No temporary probe remains.
- Final source `1ee1cedc…` and harness `792eaa7f…`; original pre-return controller remains exactly 799 bytes excluding only the new presentation inset-hook line. 628 other tracked author-base blobs are identical.

Original baseline 29 passed; 14 new presentation cases failed before implementation. Three original presentation groups per theme—six cases—were adapted to approved focus/placeholder/hierarchy changes. Viewport and dismiss-boundary regressions each strengthened two existing themed cases: predecessor 41 pass/2 fail, final 43 pass; no added cases or duplicate historical counts. Three existing harnesses change narrowly: Welcome's controller/shared guard and Login/Signup's exact fifth opt-in caller; all other guards remain intact. Actual providers/components are rendered with bounded native/router/Auth/storage mocks, not native account-switch certification.

## Native scope and limits

Five fresh final cold configurations pass on fictional iOS 18.5 fixtures: iPhone 16 Plus Light/Dark normal and Light/Dark MAX, and iPhone SE3 Light normal. Actual native names, values, disabled state and frames are exposed separately. All measured action targets are at least 44 points in both dimensions; whole MAX Next/Skip/Log-in glyphs sit above the home indicator. Public pans/blank-gap taps dismiss the keyboard; question/input and lower actions remain reachable across inspected overlaps.

One temporary unsaved `Alex` check observed enabled Next, erased exactly four characters, confirmed empty/disabled state, dismissed and refocused without pressing Next/Login/Skip. Canonical entries remain empty. Native hierarchy omits role fields and reports focused:false even with visible keyboard/cursor; declared roles are protected by source/harness, not claimed as a VoiceOver result.

The same SDK54 UI-only development binary was used for original/final evidence; it lacks Health purpose strings. No physical VoiceOver/audio, OS Reduce Motion, real account/auth action, Health/permission prompt, backend/data mutation or release certification is claimed. Failed tooling attempts, earlier 93e83/c5ac images and numeric probes are private, excluded from final pass counts/images.

Both approved fixtures are restored to usual 8081 original First name, Light/normal, exact empty field and keyboard closed. Only owned session 20221/PID 87421 was stopped normally; 8083 is free and protected services remain unchanged.

## Dependencies and rollout

Historical author base: `197d2f5349eb683309f3e85f281affb69d64bdb9`; current-main checkpoint: `f34c473c09ee5d6e8595989a298ec974974a5e5c`. Merged UI work supplies the existing Input opt-in. Published-head/current-main composition remains pending and will be reported separately before review readiness; no CI pass is claimed.

Presentation-only rollout: no schema, migration, backend, shared-theme or provider change. Prepared for review; no merge.

# U21 Body Stats native evidence

Ten unmodified native PNGs: three genuine baseline captures and seven final-candidate captures. Originals are retained in `/private/tmp/primerep-u20-u21-native-rStu8a`; repository copies are byte-identical (`cmp`, 10/10). No crops, overlays, generated screens or reconstructed before states.

Baseline: main `9f2811810329482b6871f11558f3e23c1bc1e65b`, Body Stats SHA-256 `1276dcaf5c902270aff27f3f8fa6c53c53a23fcbe2ff17e896a9787599511e8a`. All three before captures show the fictional guest's genuinely blank body fields, LB and disabled NEXT. The Dark keyboard before capture focuses an empty field; it is not a typed/selected before state. The old native accessibility tree merged the form and NEXT, although the actual NEXT was visibly present.

Every after configuration used Body Stats SHA-256 `33b83e4f48db0311c784b618ac9f9b14bffca0ecb64e8f953aeb8686ff64e8d7` on the independent Body Stats branch from that same main base. Production source was not changed during native verification.

## Completed matrix

| Configuration | Actual native result |
| --- | --- |
| iPhone 16 Plus, Light, large | Full flow passed: Male→Female, reopened native checked radio, picker close, 180 LB→81.6 KG→179.9 LB, selected-unit no-ops, background/drag keyboard dismissal retaining draft, age12 error and disabled/no-route Continue, age30 recovery. With the real numeric keyboard visible, the entire Continue was above it; one tap reached Fitness Experience (3/9), public return retained gender/weight/age. |
| iPhone 16 Plus, Dark, large | Same full flow passed with Other→Prefer not to say, exercising the other two gender choices. Real keyboard/full footer/one-tap route and retained draft also passed. |
| iPhone 16 Plus, Dark, accessibility-extra-extra-extra-large | Cold-launch scrolling/layout passed: heading/helper reached through overlapping captures, whole longest closed gender label, all four expanded rows and checked longest row, LB/KG, numeric weight and age, entire grown Continue. Age12's entire red error text and disabled CTA were reached, then age30 restored. No maximum-text route or first-tap keyboard claim. |
| iPhone 16 Plus, Light, accessibility-extra-extra-extra-large | Same cold-launch maximum-text layout/error/recovery checks passed with actual glyph inspection. No maximum-text route or first-tap keyboard claim. |
| iPhone SE, Light, large | Original guest inspected read-only: Select gender, blank weight/age, LB and disabled Continue. Returned to empty Signup without choosing, focusing or typing. |

Normal gender/CTA controls measured 56pt; unit segments 44pt. At maximum text the final native scroll viewport was y97–769, weight input y445–546, age input y644–744 and Continue y789–892 in a 932pt screen. Actual originals confirmed full number and CTA glyphs; visibility matchers alone were not treated as overlay-safe proof.

Private companion originals (`u21-after-{light,dark}-picker.png`, `-error.png`, and `u21-after-{light,dark}-max-{top,description,gender,picker-upper,picker-lower,weight,error}.png`) support picker/error/scroll reachability without expanding the published image set. Heading/helper content is naturally scrollable; not all maximum-text content is shown simultaneously in one viewport.

One initial Dark full invocation stopped at its keyboard-absence precondition before draft edits: public return had restored focus. An explicit content drag dismissed the keyboard and the complete rerun passed. Dark maximum layout passed first, then was repeated with the additional error-glyph/recovery checks. These are five configuration results, not a claim that every invocation passed.

## Capture manifest

| File | State |
| --- | --- |
| `u21-before-light-initial.png` | Original Light blank body fields |
| `u21-before-dark-initial.png` | Original Dark blank body fields |
| `u21-before-dark-keyboard-empty.png` | Original Dark empty numeric field focused |
| `u21-after-light-entered.png` | Final Light Female /179.9 LB/30, keyboard closed |
| `u21-after-dark-entered.png` | Final Dark Prefer not to say /179.9 LB/30, keyboard closed |
| `u21-after-light-keyboard.png` | Final Light age focused, real numeric keyboard, entire enabled Continue above it |
| `u21-after-dark-keyboard.png` | Final Dark same keyboard/footer proof |
| `u21-after-light-max-bottom.png` | Final Light maximum-text numbers and entire grown Continue |
| `u21-after-dark-max-bottom.png` | Final Dark maximum-text numbers and entire grown Continue |
| `u21-after-compact-light-disabled.png` | Final compact original blank guest and disabled Continue |

## Reproduction and preserved state

Use the installed development app and existing Metro server, not Expo Go. Dedicated fictional fixture: `A21DA251-8A4F-45E3-8E6D-763EDD2277D3`; original compact guest: `67BF52B6-AC88-4620-841C-2970B1D5AF0D`. Open `primerepai://onboarding/body-stats` publicly before each configuration. The owned `.maestro/body-stats-refinement.yaml` requires CLI environment values; it does not shadow them with defaults.

```sh
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=full -e FIRST_GENDER=0 -e LAST_GENDER=1 -e GENDER_LABEL=Female -e SCREENSHOT_PREFIX=/absolute/existing-dir/u21-after-light .maestro/body-stats-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=full -e FIRST_GENDER=2 -e LAST_GENDER=3 -e 'GENDER_LABEL=Prefer not to say' -e SCREENSHOT_PREFIX=/absolute/existing-dir/u21-after-dark .maestro/body-stats-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=layout -e SCREENSHOT_PREFIX=/absolute/existing-dir/u21-after-theme-max .maestro/body-stats-refinement.yaml
maestro --udid 67BF52B6-AC88-4620-841C-2970B1D5AF0D test -e MODE=empty -e SCREENSHOT_PREFIX=/absolute/existing-dir/u21-after-compact-light .maestro/body-stats-refinement.yaml
```

For layout mode, first use simctl to set the theme and `accessibility-extra-extra-extra-large`, then terminate/launch the fixture normally and reopen the public route. No state clearing. Run layout after the Dark full flow so its fictional fields are Prefer not to say /179.9 LB/30. The actual numeric keyboard is checked using `UIKeyboardLayoutStar.*`; iOS checked radios use the actual native `radio button, checked` value. Native accessibility inspection is not a VoiceOver audio/traversal test.

A supplemental `MODE=inventory` public-UI verification passed after restoring Light/large: body draft Prefer not to say /179.9 LB/30; existing 1RMs in LB were actually 100.1/225.1/315; return to Body Stats left the keyboard closed. These are the observed results of existing rounded conversions, not a claim of mathematically exact restoration for arbitrary values. Fictional body fields remain entered; no claim that required gender was restored to its original blank state. Existing Get Stronger goal, name, reason and experience were not edited in this task. Original compact guest remains at empty Signup.

No authenticated simulators, signup/login submissions, Health actions, backend/database mutations, mocks, container inspection, state/keychain resets, native builds, dependency/config changes or server restarts. Shared cyan Skip remains oversized/clipped at maximum text outside this screen's scope. No physical device, Android, VoiceOver audio, OS Reduce Motion or animation-frame timing coverage is claimed. The native UI and Maestro skills guided the actual-control, keyboard and original-image verification.

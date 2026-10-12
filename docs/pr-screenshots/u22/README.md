# U22 Training Frequency native evidence

Ten unchanged native PNG originals: three genuine BEFOREs and seven AFTERs. Originals remain in `/private/tmp/primerep-u22-u23-u25-native-ZRoGID`; repository copies are byte-identical (`cmp`, 10/10). No crops, annotations, generated screens or reconstructed states.

BEFORE base: main `6ffc2364bf5203127b71829f4c527583b6063460`, screen SHA-256 `b55c50f121303e36e9278116e83773306a86466f66569a470157463a5d949b30`. Light/Dark initial captures genuinely had no frequency selected and a visibly disabled NEXT. The Dark selected BEFORE is the permitted fictional 3-days choice on the same untouched source. Baseline inventory is retained privately in `BEFORE-INVENTORY.md` alongside the originals.

AFTER: independent `feat/ui-training-frequency-refinement` from that base, frozen screen SHA-256 `ac8df328231c1051b38707cab323ab528961dacbfa150dbafb425493f2e83bbe`. The expected hash was checked before every native configuration and still matched afterward. Native verification made no production changes.

## Completed configurations

| Device / appearance / text size | Actual native result |
| --- | --- |
| iPhone 16 Plus / Light / large | Prefilled 3-days checked; 1-day→2-days→4-days→3-days selections checked, previous choices explicitly unchecked. Whole Every day row and Continue reached. Actual Continue→Workout Split (6/9), public return retained 3-days and 4-days unchecked. |
| iPhone 16 Plus / Dark / large | Prefilled 3-days checked; 5-days→6-days→every-day→3-days checked replacements, previous choices unchecked. Same actual forward route and public-return persistence. Both normal themes collectively exercised all seven choices. |
| iPhone 16 Plus / Dark / accessibility-extra-extra-extra-large | Cold launch without reset; actual scrolling reached whole question/helper, all seven option titles and both tag copies. Actual Every day radio activation/checked state, entire naturally grown readable Continue above safe area. Layout/selection coverage, no maximum-text forward-route claim. |
| iPhone 16 Plus / Light / accessibility-extra-extra-extra-large | Same cold maximum-text glyph/scroll checks; actual 3-days radio activation/checked state and entire grown readable Continue. Layout/selection coverage, no maximum-text forward-route claim. |
| iPhone SE / Light / large | Original empty guest inspected read-only. Scrolled to actual disabled Continue, then returned to empty Signup. No choice, typing or local draft writes. |

Five configurations passed, plus one supplementary Dark maximum-text helper-capture run. No failed native test invocation. Some 100%/centering target matches still allowed glyphs under the shared header; actual originals were inspected, and a bounded content drag captured the whole helper. A matcher alone is not proof against native-header overlap. Maximum-text content is reached through overlapping real scroll captures, not shown all at once in one viewport. Natural tag wrapping splits the word Recommended across lines at maximum text; every glyph is present, with no ellipsis or font cap.

Normal native row frames measured 64–65pt, recommended rows 94–95pt, Continue 56pt. The initial Continue frame was y838–894 in a 932pt screen; explicit bottom scrolling produced the separately captured larger safe-area gap. These are actual native frame/glyph checks, not a VoiceOver audio/traversal test.

Private companions `u22-after-{light,dark}-max-{top,description,1-day,2-days,tag-3-days,3-days,tag-4-days,4-days,5-days,6-days,every-day,selected}.png` retain glyph/activation proof. Whole-helper originals: `u22-after-light-max-description-whole.png` and `u22-after-dark-max-helper-description-whole.png`.

## Published capture manifest

| Original copied unchanged | Actual state |
| --- | --- |
| u22-before-light-initial.png | Original Light unselected /disabled NEXT |
| u22-before-dark-initial.png | Original Dark unselected /disabled NEXT |
| u22-before-dark-selected.png | Original Dark 3-days selected /enabled NEXT |
| u22-after-light-selected.png | Final Light 3-days selected, top/full question and helper |
| u22-after-dark-selected.png | Final Dark 3-days selected, top/full question and helper |
| u22-after-light-bottom.png | Final Light scrolled-bottom/full Continue and safe-area gap |
| u22-after-dark-bottom.png | Final Dark scrolled-bottom/full Continue and safe-area gap |
| u22-after-light-max-bottom.png | Final Light maximum text/full Continue; 3-days remains selected above this viewport |
| u22-after-dark-max-bottom.png | Final Dark maximum text/Every day checked/full Continue |
| u22-after-compact-light-disabled.png | Final compact empty guest/scrolled bottom/disabled Continue |

## Reproduction and state

Use the existing installed development app and Metro 8081, not Expo Go: the custom HealthKit binary is required. Open the public `primerepai://onboarding/training-frequency` route first. Dedicated fictional fixture: `A21DA251-8A4F-45E3-8E6D-763EDD2277D3`. Original compact guest: `67BF52B6-AC88-4620-841C-2970B1D5AF0D`. Required CLI variables have no YAML defaults that shadow `-e`.

```sh
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=full -e FIRST=1-day -e SECOND=2-days -e THIRD=4-days -e FINAL=3-days -e SCREENSHOT_PREFIX=/absolute/existing-dir/u22-after-light .maestro/training-frequency-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=full -e FIRST=5-days -e SECOND=6-days -e THIRD=every-day -e FINAL=3-days -e SCREENSHOT_PREFIX=/absolute/existing-dir/u22-after-dark .maestro/training-frequency-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=layout -e SELECT_ID=every-day -e SCREENSHOT_PREFIX=/absolute/existing-dir/u22-after-dark-max .maestro/training-frequency-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=layout -e SELECT_ID=3-days -e SCREENSHOT_PREFIX=/absolute/existing-dir/u22-after-light-max .maestro/training-frequency-refinement.yaml
maestro --udid 67BF52B6-AC88-4620-841C-2970B1D5AF0D test -e MODE=empty -e SCREENSHOT_PREFIX=/absolute/existing-dir/u22-after-compact-light .maestro/training-frequency-refinement.yaml
```

Set each requested simulator appearance using simctl. Before each maximum-text layout, set `accessibility-extra-extra-extra-large`, then terminate/launch the fictional app normally and reopen its public route; never clear state. Full mode deliberately requires the existing 3-days prefill. Actual iOS radio values are `radio button, checked` and `radio button, unchecked`; no unsupported checked matcher or decorative glyph substitutes for state.

Final fictional fixture: Light/large, keyboard closed, existing 3-days selection retained after normal cold relaunch/public-route verification. It was not restored to the original BEFORE's empty choice; existing card UI offers no blank deselection. Own Large Gym/PrimeRep Optimized choices from the separate baseline phase remain unchanged. Name/reason/experience/goal/body/1RM/equipment fields were not edited here. Original compact guest remains at empty Signup.

No authenticated simulators, account/signup/login submissions, Health actions, backend/database mutations, mocks, private-container reads, state/keychain resets, native builds, dependency/config changes or server restarts. Workout Split was only the actual forward destination; Custom and all other controls there were untouched. Shared cyan Skip is oversized/clipped at maximum text outside this screen's scope. No physical device, Android, VoiceOver audio, OS Reduce Motion or animation-frame timing coverage is claimed. The native UI and Maestro skills guided public-control, original-glyph and state-preservation verification.

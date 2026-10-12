# U23 — Training Place native evidence

Five iOS 18.5 configurations passed on the existing custom development binary (`com.diegozegarra.primerep`): two normal-text interaction runs, two cold maximum-text layout runs, and one compact empty-state read-only run. One additional restoration flow passed. No failed Maestro test invocation occurred after the isolated launch bundle became available.

## Provenance

The three BEFORE originals were captured from main `6ffc2364bf5203127b71829f4c527583b6063460`, before production edits, with Training Place SHA-256 `cbb7da89352c9ae5e013524f08556ede489a0a959de65d0da8af6c0859bf5db2`. The initial images precede the fictional guest's first selection; the selected Dark image shows its original Large Gym presentation.

Every AFTER configuration and the final post-run check matched frozen Training Place SHA-256 `f6e48b97cf50fbbb3807a1f0e95c0fba90ef68a1efd3ad01d89d2638471e99f7`. The isolated project was served on port 8083; actual native `training-place-scroll`, option radios, and Continue IDs proved that the candidate bundle—not the usual port-8081 checkout—was loaded. Normal port 8081, Python port 8082, and the usual backend were not restarted or modified.

All ten PNGs are byte-for-byte copies (`cmp`: 10/10) of unmodified originals in `/private/tmp/primerep-u22-u23-u25-native-ZRoGID`. No overlays, cropping, resizing, or recreated screenshots were used. Fixture images are 1290×2796; compact is 750×1334.

Two initial development-client connection attempts failed before native testing: LAN then loopback could not connect to the absent isolated listener. A subsequently restarted server exposed a launch-asset 404 caused by its external dependency symlink. The coordinator repaired the isolated server using existing dependencies and verified manifest and actual JavaScript responses as HTTP 200 before retry authorization. No native pass or AFTER screenshot is attributed to those failed connections; the connection-error diagnostic remains private and is excluded here.

## Native matrix

| Configuration | Actual checks |
| --- | --- |
| iPhone 16 Plus, Light, Large | Existing Large Gym prefill; select Small Gym → Garage Gym → Large Gym, each checked with previous option unchecked; whole question/helper/cards/Continue; public Training Frequency → Training Place remount retains Large Gym. |
| iPhone 16 Plus, Dark, Large | Same three-option replacement and public remount checks; Large Gym selected in both normal comparison images. |
| iPhone 16 Plus, Dark, maximum accessibility text | Cold launch without resetting state; question/helper/all three titles and descriptions reached and glyph-inspected across overlapping scroll positions; actual Small Gym activation and checked state; whole grown Continue above the safe area; no keyboard. |
| iPhone 16 Plus, Light, maximum accessibility text | Same cold glyph/scroll checks; actual Garage Gym activation and checked state; whole grown Continue above the safe area; no keyboard. |
| iPhone SE, Light, Large | Original guest's three options all unchecked; all card descriptions and disabled Continue reachable; public return to empty Signup without changing any choice or field. |

Native iOS radio values were asserted as `radio button, checked` / `radio button, unchecked`. The final normal hierarchy measured Large Gym 108 pt high, Small Gym 91 pt, Garage Gym 90 pt, and Continue 56 pt, all wider than 44 pt. These are native touch frames, not a VoiceOver audio test.

At maximum text the long Large Gym card spans more than one viewport. Its full description and the helper were inspected through overlapping original captures; no claim is made that the entire card is visible in a single frame. Native header overlay can cover the first line in a centered accessibility snapshot, so actual top/companion captures—not visibility percentages alone—were inspected. The normal bottom captures intentionally scroll the question partly under the header while showing the complete footer. No font cap or production workaround was introduced by this test work.

Continue was never pressed on Training Place. There is **no native forward-route or Equipment-default initialization claim**. The native persistence check used only public route remounts; controller route parameters and Equipment behavior belong to the separate component harness. Equipment, Custom Split, account submission, login, Health, private app storage, database changes, and permission prompts were not exercised.

## State boundaries and completion

Only the fictional 16 Plus fixture `A21DA251-8A4F-45E3-8E6D-763EDD2277D3` received local training-place choice changes. It finished with Large Gym checked, the other two unchecked, Light appearance, Large text, and the real keyboard absent. Its previous fictional name, reason, frequency, split, body, and 1RM draft were not edited by these flows. An initially empty choice cannot be restored through the existing UI; this is not described as blank-state restoration.

The original compact guest `67BF52B6-AC88-4620-841C-2970B1D5AF0D` finished at empty Signup. After all candidate tests and evidence were complete, both devices were reconnected through the public development-client link to the existing usual Metro on port 8081. Two cleanup-only checks passed: the fictional fixture visibly retained Large Gym on the usual server's original Training Place presentation, with Light appearance, Large text and no keyboard; the compact guest showed empty Signup with no keyboard. These private cleanup captures are not candidate AFTER evidence and are excluded from the ten published PNGs. Authenticated simulators were not used. No state clear, keychain reset, native rebuild, package/configuration change, backend mutation, or app-source edit was performed by this native evidence task.

Coverage is iOS Simulator only: no Android, physical device, VoiceOver spoken traversal, OS Reduce Motion, or native animation frame-timing claim.

## Reproduce

Use only the approved fictional fixture for `full`, `layout`, and `restore`; use the original compact guest only for `empty`. Connect the existing development client to the coordinator's verified isolated server first:

```sh
xcrun simctl openurl A21DA251-8A4F-45E3-8E6D-763EDD2277D3 'primerepai://expo-development-client/?url=http%3A%2F%2F192.168.86.34%3A8083'
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=full -e SCREENSHOT_PREFIX=/absolute/existing-dir/u23-light .maestro/training-place-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=layout -e SELECT_ID=small-gym -e SCREENSHOT_PREFIX=/absolute/existing-dir/u23-dark-max .maestro/training-place-refinement.yaml
maestro --udid 67BF52B6-AC88-4620-841C-2970B1D5AF0D test -e MODE=empty -e SCREENSHOT_PREFIX=/absolute/existing-dir/u23-compact-light .maestro/training-place-refinement.yaml
maestro --udid A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test -e MODE=restore -e SCREENSHOT_PREFIX=/absolute/existing-dir/u23-restoration .maestro/training-place-refinement.yaml
```

`MODE` and `SCREENSHOT_PREFIX` are required CLI environment values, with no YAML defaults that shadow overrides. `layout` additionally requires `SELECT_ID`; use `garage-gym` for the Light maximum-text run. Set the intended OS appearance and text size before each run; maximum text is `accessibility-extra-extra-extra-large`. Cold terminate/launch without clearing state after changing the OS font size, to avoid the previously observed warm-layout metric issue. `full` expects the known Large Gym prefill; use the restoration mode at normal Large text first if needed.

## Published originals

- `u23-before-light-initial.png`
- `u23-before-dark-initial.png`
- `u23-before-dark-selected.png`
- `u23-after-light-selected.png`
- `u23-after-dark-selected.png`
- `u23-after-light-bottom.png`
- `u23-after-dark-bottom.png`
- `u23-after-light-max-bottom.png`
- `u23-after-dark-max-bottom.png`
- `u23-after-compact-light-disabled.png`

Private maximum-text top/helper/description/selection companion originals remain in the artifact directory for glyph-reach review; only the ten approved comparison originals are included in this directory.

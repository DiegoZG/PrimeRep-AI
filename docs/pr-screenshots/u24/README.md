# U24 Equipment native evidence

Eleven unedited simulator PNGs: four genuine original BEFORE frames and seven final AFTER frames. The five final cold configurations completed on isolated fictional UI fixtures only. No existing A21 or existing compact simulator was used for Equipment state writes.

## Frozen sources and runtime

Candidate: `/private/tmp/primerep-u24-baseline-XphlxY/worktree`, branch `feat/ui-equipment-refinement`, base `10b638cb4c480ee59c0c7f07596c828dd8c91ce2`.

| Source | BEFORE SHA256 | Final AFTER SHA256 |
| --- | --- | --- |
| `app/onboarding/training-place/equipment.tsx` | `f7136c4c4abb9d5e0cf53f47bd307d1b9aacc75c716c92732f3cf8637e3abc64` | `806c7593ba6a85d305e1e3bc60be83cacdf7d5e99fbf0767780f53c5faf13c58` |
| `components/equipment/equipment-card.tsx` | `e297ae394c5732d1730eb0afc90b755ee92e5a127eca5d1123ae01834d4795e0` | `711948254f316a423a2ef4e67007f6dc5b1c3002d4dc4a9235e6d35d56e3e854` |

Original hashes were checked before original captures; final hashes were checked before final cold configuration batches and remained frozen. The original and final owned Metro manifests and their exact advertised launch assets returned HTTP 200, SDK 54.0.0, the candidate projectRoot, native ID `com.diegozegarra.primerep`, scheme `primerepai`, and API `http://192.168.86.34:8000`. The final native bundle contains the opt-in checkbox and separate Edit semantics. No source/config/environment-file or dependency-version changes were made by the native actor.

The existing installed A21 binary was reused without rebuilding: `/Users/diegozegarra/Library/Developer/CoreSimulator/Devices/A21DA251-8A4F-45E3-8E6D-763EDD2277D3/data/Containers/Bundle/Application/0BBE1CE9-C893-4EBE-BFBB-2DF314D66F01/PrimeRepAI.app`. It lacks Health purpose strings; reuse was explicitly UI-only and does not certify Health integration or permissions. No Health/notification OS grant was requested.

## Fixtures and cold matrix

| Owned fictional fixture | UUID | Runtime/type | Configurations |
| --- | --- | --- | --- |
| PrimeRep U24 Baseline w4WyeH | `6048B3FD-366F-4BAD-A944-44E45A4FD9DD` | iOS 18.5 (22F77), iPhone 16 Plus | Light/large, Dark/large, Light/MAX, Dark/MAX |
| PrimeRep U24 Compact EI8br0 | `DFD527A2-451F-42FF-871A-6B6F0193864A` | iOS 18.5 (22F77), iPhone SE (3rd generation) | Light/large |

Every final configuration used a cold terminate/public developer-client reconnect to owned port 8083, then public Equipment navigation after `auth-loaded`. Normal text was `large`; MAX was `accessibility-extra-extra-extra-large`. No font cap was imposed on user text. The first public developer-link Open confirmation and standard Expo developer Continue/Close were used only after observing the correct app/owned connection; those are startup controls, not OS permission grants.

The four original frames and four normal final Plus frames are genuine same-device comparisons. The compact AFTER has no compact BEFORE and is not presented as a same-device comparison.

## What was verified

Selected purple borders/checkmarks remain meaningful. The original 18-card visible shortlist remained selected after the authorized Crossover Cable OFF→ON check: cable pair, Dumbbells, four benches/racks, three plated machines, four weight machines, two accessories, Olympic Barbell, and Plates. This is the visible shortlist, not every catalog item. Original weight data is unchanged: Dumbbells 2.5 through 125... (31 entries), Plates `1.25, 2.5, 5, 10, 15, 20, 25, 35, 45, 50`; no weight unit is displayed.

Native hierarchy now exposes separate `Dumbbells, <unchanged subtitle>` / `Plates, <unchanged subtitle>` checkbox nodes and `Edit Dumbbells` / `Edit Plates` nodes. Crossover Cable's actual native value changed from `checkbox, checked` to `checkbox, unchecked` and back to `checkbox, checked`, with the visible check restored. Maestro's generic `checked` field stays false even when the actual native value says checked; it is not used as proof. The frozen rendered code declares checkbox/button roles; the dump exposes checkbox role in its native value and separate Edit labels/frames, but does not expose a separate raw button-trait field. No VoiceOver audio claim is made.

| Measured native target | Normal Plus | MAX Plus |
| --- | --- | --- |
| Edit Dumbbells | 44×44, separate named node | Whole grown Edit glyph verified in overlap frames; no separate MAX size claim |
| Edit Plates | 44×44, separate named node | 87×75, separate named node |
| See all Bars and plates | 382×44 | 382×136 |
| Search for equipment | 382×46 | 382×94 |
| NEXT | 382×52 | 382×101 |

All Dumbbells/Plates weight glyphs, names, Edit text, and See all text remained reachable at MAX through overlapping scroll frames. Giant cards are not claimed to fit one viewport. The two published MAX footer frames show the final weight tail, whole Edit/See all, and the whole unchanged grown Search/NEXT above the home indicator; private companions prove the beginning/middle of each weight list. Decorative initials and checkmark glyphs remain intact at MAX. Normal and compact final footers show whole labels and safe spacing.

One public See all Cable machines navigation verified the actual category destination. One genuine main Search navigation verified the actual visible Search Equipment destination and observed header Back return to the actual Equipment screen. No text was typed and no selections were changed in either dependent route. Edit was never pressed; the known editor-loop behavior is not fixed or tested. NEXT, notifications, Health, auth/account actions, OS permission dialogs, private app data, clearState, and data reset were not exercised.

This was not blanket read-only testing: Large Gym setup, Equipment's existing mount synchronization/default initialization, and exactly two Cable selection actions wrote only fictional local fixture state. Capture scrolling, hierarchy inspection, and the public navigation checks did not add user selections or backend mutations.

## Raw provenance and captions

Original raw directory: `/private/tmp/primerep-u24-native-baseline-w4WyeH` (complete original report and private original MAX inspection). Final raw directory: `/private/tmp/primerep-u24-native-final-EI8br0` (five configuration command/debug logs, native hierarchies, private MAX glyph companions, interaction/navigation diagnostics, and cleanup evidence). Each published PNG was byte-compared with its named raw original; no crop, resize, composite, or editing was performed. Ten Plus files are 1290×2796; the compact file is 750×1334.

| PNG | Caption | SHA256 |
| --- | --- | --- |
| `u24-before-light-initial.png` | Original Plus Light initial, selected shortlist and original weight/Edit styling | `3e0c9d343ab464b68676628c75df0f12c482df818fc2c68ca334d10374a64bf4` |
| `u24-before-dark-initial.png` | Original Plus Dark initial | `d37f08ecc02b098fb865e1ca165bf5314e938676a0052e6b6ddefcaca45a323c` |
| `u24-before-light-footer-end.png` | Original Plus Light actual list end, Plates/Edit/See all/Search/NEXT | `b7b8c842e5a9b80fcd611ebeef086ee418ed3064b1e5b4eae98075832603431f` |
| `u24-before-dark-footer-end.png` | Original Plus Dark actual list end | `b4864159883a266fad3af6e95afe360c60c62a40b9739b1b1f42cfa2eacf20d9` |
| `u24-after-light-initial.png` | Final cold Plus Light initial, readable neutral secondary text/Edit, preserved selection | `e8dba52ee7eb7829ddc8c3aa32f04390fbf4b783a59463ead31f921c536914be` |
| `u24-after-dark-initial.png` | Final cold Plus Dark initial | `746e9339706d16ae62d3a412ce186b41c2c58c277beb480fb85dc65893f6edcf` |
| `u24-after-light-footer-end.png` | Final cold Plus Light list end and whole footer | `611c3e616a71f42188050ef5350babc7c98eeb3434a82f1a939cd39d87566c88` |
| `u24-after-dark-footer-end.png` | Final cold Plus Dark list end and whole footer | `ed205d27f60bbea2d21624f3ef450117eada46e3fed5ce4d0c43f10f365b63c1` |
| `u24-after-light-max-footer-end.png` | Final cold Plus Light MAX weight tail/Edit/See all and whole grown footer; not the entire giant card | `32a3f52b2b0c6a301ebe0406415e643bc2a0371620f9140a15da1cb516b249b2` |
| `u24-after-dark-max-footer-end.png` | Final cold Plus Dark MAX same footer scope | `166807c2e8852edb4716c204aa162b8ee92e00d257fcd0709600b0bae01364b5` |
| `u24-after-compact-light-footer-end.png` | Final cold new SE Light list end, natural wrapped Plates weights and whole footer | `9fe72e508766bb9f8e73ef9a395b4220bfaec1b05e43fdb766cf9647eefb43fa` |

Private diagnostics are excluded from the eleven published frames and five configuration count: original live-switch MAX stale layout; a selector-only Cable ON assertion that stopped before tapping (restoration then used the verified visible checkbox frame once); a native Back/underlying Back-label false positive in the first optional navigation flow; a bounded long reverse-scroll timeout; and a YAML direction validation failure before native commands ran. Light/MAX first weight glyphs were supplemented by a fresh cold entry. Normal capture steps completed before MAX-only capture branches were added; the final flow keeps equivalent normal steps and static MAX branches. No flow failure is relabeled as an app fix or extra passing configuration.

## Reproduction and owner boundary

Use `.maestro/equipment-refinement.yaml` only on owned fictional fixtures after external cold guest launch/theme/size setup. Pass `MODE=normal|max|compact` and an absolute `SCREENSHOT_PREFIX`. The flow only navigates publicly and scrolls/captures; it never taps Edit/NEXT, a selection, or permission/account controls. The private Cable/navigation flows are supplemental, not folded into the five matrix count.

The owned Metro foreground session was `29069`, PID `24077`, port 8083. All final captures are complete. Both new fixtures completed cleanup through the public usual-8081 developer-client guest: actual Light appearance / `large` queries, visually selected Large Gym, then actual original Equipment/default weights with keyboard absent. The usual manifest returned HTTP 200, SDK54, the real frontend projectRoot, and launch asset port8081. The usual Training Place is an older unrefined screen with no candidate testIDs, so a selector-only cleanup stop was resolved by inspecting its actual selected merged Large Gym/checkmark label, not changing a choice. Private `cleanup-plus-preflight.png`, `cleanup-plus-equipment.png`, `cleanup-compact-place.png`, `cleanup-compact-equipment.png`, and the unobscured `cleanup-compact-visible-defaults.png` are restoration evidence, not AFTER artifacts. The final compact frame shows all31 original Dumbbells weights, selected checkmark, Edit, Search and NEXT with no keyboard. No fixture was deleted or reset. Existing A21/compact devices were not touched.

After actual cleanup and explicit parent STOP, Ctrl-C was sent only to owned session29069. Expo returned `Stopped server`, exit0. Read-only process/listener proof at 2026-10-13 01:34 UTC confirms PID24077 absent and no8083 listener; protected listeners remain node77763 on8081, Python77326 on8000, and Python22150 on8082. No unknown process was stopped. Runtime ownership is fully handed back; fixtures remain retained on public usual8081 Light/large Equipment for recovery/review.

Final owned capture-flow SHA256: `85b56c7ad7c8def2445b063bacb792b958050ddd6b653e612a8638543cd385d1`. The rendered route/Card hashes remain the frozen final values above. No Git staging/commit/push or PR-doc edit was performed by this native actor.

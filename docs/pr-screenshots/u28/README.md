# U28 Notifications native evidence

Final screen source SHA256: `d2c8bf3bb84b3c7a988de5ecd837ca289e54618a2b4a26f916d5002ead340067`.

All seven AFTER images are fresh raw captures of this final footer source. The two genuine BEFORE images retain original source SHA256 `35b25abf2cb3ac6ae0e722c033afcec48e1fc5fc6d2691fa3b5bb76c30bc65b7`. No PNG was edited, cropped, recomposed, or relabeled from a predecessor run. Each canonical file was compared byte-for-byte with its raw original.

BEFORE uses C3 `C3D67687-978B-4319-80AF-26BB0A56B525`, with inherited `large` text. AFTER uses the separate A21 guest fixture `A21DA251-8A4F-45E3-8E6D-763EDD2277D3` and compact guest `67BF52B6-AC88-4620-841C-2970B1D5AF0D`. These are different fixtures/devices, not a claim of a single untouched device before and after. All notification content shown is illustrative screen copy, not real delivered notifications or personal workout records.

## Canonical raw assets

| File | Caption | Dimensions | SHA256 |
| --- | --- | --- | --- |
| `u28-before-light-large-initial.png` | Genuine original C3 Light/large initial screen, four old simulations | 1290×2796 | `3625df9eb6970aa680e757848e66631463b186062227c456fffcac32fae4bb48` |
| `u28-before-dark-large-initial.png` | Genuine original C3 Dark/large initial screen, four old simulations | 1290×2796 | `e796c3a28c21283ccbbfa01e4b0aa11fe104ace91a5615e62bcbbbfd1cb3418c` |
| `u28-after-light-initial.png` | Final A21 Light/large initial view; conditional examples and footer | 1290×2796 | `d04aba90963d64ae9cfeb6da3db623b18a8cf84a03ed96e94c8fff05ecfd1e51` |
| `u28-after-dark-initial.png` | Final A21 Dark/large initial view; conditional examples and footer | 1290×2796 | `f384345c8d0ea897f1e6e35b4963f2087d10d30c9e595f9f06dddf059d25f0aa` |
| `u28-after-light-bottom.png` | Final A21 Light/large; Enable and footer Skip fully reached and verified | 1290×2796 | `d04aba90963d64ae9cfeb6da3db623b18a8cf84a03ed96e94c8fff05ecfd1e51` |
| `u28-after-dark-bottom.png` | Final A21 Dark/large; Enable and footer Skip fully reached and verified | 1290×2796 | `f384345c8d0ea897f1e6e35b4963f2087d10d30c9e595f9f06dddf059d25f0aa` |
| `u28-after-light-max-bottom.png` | Final A21 Light/MAX; two-line Enable and complete grown Skip glyph | 1290×2796 | `429b29b655a6ecfb976ea3c8acfbdde0a011e89916e24ea57a5b93e0765f4f42` |
| `u28-after-dark-max-bottom.png` | Final A21 Dark/MAX; two-line Enable and complete grown Skip glyph | 1290×2796 | `4e254cdbe71102119b108dadfbe9a1ee1acc970746ee28bb8407cb1d9c3f1e62` |
| `u28-after-compact-light-bottom.png` | Final compact Light/large; wrapped example copy and both intact footer actions | 750×1334 | `abf0ad13922c5af6fa40d7344c259e8ba4ceec8be24a6b365aedce1800487c60` |

Normal A21 content fits the viewport, so initial and bottom captures are genuinely identical within each theme. The flow still verifies full reach of each example and both controls; the identical hashes do not imply a different scroll position. The compact view requires scrolling. MAX content is inspected through overlapping private views, not a claim that heading, description, every card, and footer fit into one frame.

## Five fresh cold native cases

Standard text is simctl `content_size large`; MAX is `accessibility-extra-extra-extra-large`. Each case configured appearance/text size, terminated only the existing PrimeRep app, and cold opened the same installed development client on owned Metro 8083. The fixture was never cleared or reset.

| Configuration | Native result | Enable target, points | Footer Skip target, points |
| --- | --- | --- | --- |
| A21 Light/large | PASS | 382×56 | 382×44 |
| A21 Dark/large | PASS | 382×56 | 382×44 |
| A21 Light/MAX | PASS | 382×169 | 382×86 |
| A21 Dark/MAX | PASS | 382×169 | 382×86 |
| Compact Light/large | PASS | 327×56 | 327×44 |

Native accessibility hierarchies provide the dimensions, names **Enable notifications** and **Skip notifications**, and enabled state. Each final image was visually inspected. The native header has no inherited Skip action; the sole Skip is the full-width footer Pressable. Both MAX footer labels are complete and naturally grown, with their glyphs above the home indicator. The three examples retain intact PrimeRep/Example labels in the stacked text column.

Both MAX sets include private `-top`, `-settings`, `-clarification`, `-example-upcoming-workout`, `-example-training-week`, `-example-equipment-review`, and `-enable` companions. They show the uncapped heading, account/Settings condition, example-only clarification, all three supported messages, stacked metadata, and primary action across overlapping scroll views. Cropped neighboring content at viewport edges is expected while scrolling; the full text is assessed across the overlapping views. These companions are not added to the nine canonical images.

Native captures are deliberately read-only. The flow waits for `auth-loaded`, opens only public routes, asserts, scrolls, and captures. It never taps Enable, Skip, choices, inputs, signup/login, or OS permission controls. No actual OS permission request, grant/refusal/revocation, busy-state transition, notification delivery, VoiceOver, reduced-motion, Android, physical-device, or Health certification is claimed.

## Runtime and source provenance

Owned worktree: `/private/tmp/primerep-u28-baseline-wrHZCR/worktree`, branch `feat/ui-notifications-refinement`, base `6ffc2364bf5203127b71829f4c527583b6063460`. Final route hash was checked before the cases and afterward. Exact Enable/Skip business handlers remain `63bfe9003ab8e60b08a55c4ce6862fe87006c800f5cd453bb7e8d8c1089d1f61`; independent engineering verification froze the shared/provider/service boundaries and neighboring constants.

The existing installed dev client `com.diegozegarra.primerep` used scheme `primerepai`; no binary installation/build or dependency version change occurred. Owned Metro ran foreground session **9280**, PID **2416**, on **8083**, with `EXPO_PUBLIC_API_URL=http://192.168.86.34:8000`. Its actual manifest returned HTTP 200, SDK `54.0.0`, exact owned projectRoot, native app ID, and scheme. The exact advertised iOS launch asset returned HTTP 200 and contained the final footer/scroll/heading/description/example/Skip/Enable selectors, all three supported bodies, and the correct API. Asset SHA256: `f642d80e1bde00664d12c0dbf1fd850bd5ac46e57e9c240f1600ea96ec8120bb`.

Raw evidence root: `/private/tmp/primerep-u28-native-final-2gwaxd/`. `capture-provenance.json` records all nine raw/canonical byte comparisons, full hashes, dimensions, source hashes, device IDs, and all five measured footer frames. `runtime-proof.log`, `manifest.json`, `manifest.headers`, `launch-asset.bundle`, and `launch-asset.headers` establish the final runtime. Case logs are `light-normal.log`, `dark-normal.log`, `light-max.log`, `dark-max.log`, and `compact-light.log`; each completed with exit 0. The `*-hierarchy.json` files retain the native frame evidence. All private screenshots and cleanup files remain at this raw root.

The older `/private/tmp/primerep-u28-native-RYQSN4/` captures are private predecessor diagnostics for source 409, including the former clipped header Skip. They do not certify this revised footer and are not any final AFTER file.

## Reproduction and cleanup boundary

Use only the approved existing anonymous fixtures and installed development app. Set the case's theme and exact content size, terminate the app without clearing state, then open `primerepai://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083`. The first Light case used the equivalent owned LAN host `192.168.86.34:8083`. The checked-in `.maestro/notifications-refinement.yaml` requires explicit `MODE` and absolute `SCREENSHOT_PREFIX`, with no defaults that override CLI arguments.

```sh
maestro --device A21DA251-8A4F-45E3-8E6D-763EDD2277D3 test \
  --no-reinstall-driver \
  --test-output-dir /private/tmp/primerep-u28-native-final-2gwaxd \
  -e MODE=layout \
  -e SCREENSHOT_PREFIX=/private/tmp/primerep-u28-native-final-2gwaxd/u28-after-light-max \
  .maestro/notifications-refinement.yaml
```

Use `MODE=normal` for A21 large, `layout` for MAX, and `compact` for compact large, selecting the corresponding approved device and fresh screenshot prefix. The compact matrix remains on its footer long enough to measure it; actual usual-server restoration is a separate explicit cleanup flow.

Cleanup was completed before stopping the owned runtime. Read-only checks confirmed usual checkout `5b3c06240e680e429edf1c1bbe4354336136ffba` and protected Metro 8081 PID **77763**. Both guests were reset only to OS appearance **Light** and content size **large**, cold reconnected through the public developer-client URL on **8081**, and checked via public routes:

- A21: Custom Split empty with minimum-one-day validation and disabled Continue; frequency **3 days** radio checked; **Large Gym** selected; **PrimeRep Optimized** selected; keyboard absent. Final visible page is Workout Split. Selection screenshots were visually inspected; no choice was pressed.
- Compact: actual empty Signup with Email/Password placeholders and unchecked terms; keyboard absent. Its private final screenshot was visually inspected.

Private `usual-server-cleanup.yaml`, `cleanup-a21.log`, `cleanup-compact.log`, and `cleanup-*.png` retain those actual results. Display settings were queried afterward and returned Light/large for both devices. No logout, account request, direct app-data inspection, storage/keychain manipulation, `clearState`, or “back to guest” reset was used.

After that cleanup, the coordinator explicitly issued ROOT STOP. Only session **9280** received Ctrl+C and exited 0 with “Stopped server.” PID **2416** no longer existed and port **8083** was free. Protected listeners remained unchanged: **8081 PID 77763**, **8000 PID 77326**, **8082 PID 22150**. No unknown process was stopped.

## Engineering coverage limits

Independent final engineering GO is `/private/tmp/u28-footer-independent.o0UBGR/REPORT.json`: **47 focused**, **679 named core**, **680 standard**, with the UI-audit runner counted once; types, scoped lint, interaction audit/self-tests, diff check, and a fresh 62-HTML export pass. Normal Expo lint has zero errors and the two inherited shared-component warnings.

Accounting is explicit: original baseline 32; approved presentation expectations yielded 27 passes/18 failures before production and then 45 passes; two distinct footer expectations yielded historical 45 passes/2 failures and then final 47 passes. This does not claim all baseline presentation expectations stayed unchanged or count historical duplicate renders. Supplemental A→B/logout probes passed with mocked OS/storage/HTTP boundaries and are excluded from 47/679/680.

Permission success/refusal/failure/busy/Skip/persistence behavior is covered by the actual-screen harness with real providers and mocked OS/router/auth/storage/push boundaries, not by activating those actions on these guests. Contrast proofs apply to stated active token pairings; inactive disabled labels do not universally meet 4.5:1 and are not claimed to do so. Publication remains the coordinator's separate step after reviewing these assets and the final PR description.

# Refine notification onboarding with factual examples

Notification onboarding previously presented an unlabeled running workout timer, rest notifications, and a fabricated Strength Score improvement. The screen now shows three static, explicitly labeled examples from the implemented Coach notification contract. It explains that users can enable Coach reminders in Settings after creating an account; allowing OS access here does not promise reminder delivery.

Native maximum-text inspection found the predecessor's own Skip label clipped inside the fixed-height navigation header. Enable and Skip now share the inset-aware scrolling footer: filled purple Enable first, followed by a full-width neutral Skip whose label and target can grow with text. A route-local declarative header override removes the inherited shared Skip from this page without changing the shared layout.

Before, original Dark/large on the C3 guest:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-before-dark-large-initial.png" width="320" alt="Original Dark notification onboarding on C3 with four unsupported simulations and header Skip" />

After, final Dark/large on the separate A21 guest:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-dark-initial.png" width="320" alt="Final Dark notification onboarding on A21 with three conditional labeled examples and complete Enable and neutral footer Skip" />

Both normal comparison guests use iPhone 16 Plus, but they are different guests/devices. Examples are illustrative screen copy, not real delivered notifications or personal workout records. The final normal content fits one viewport; initial and bottom captures are genuinely identical within each theme, not different scroll positions. Seven other canonical captures are collapsed below.

## Changes

- Replace four unsupported simulations with three static examples: “Today’s workout is ready.”, “Review your training week.”, and “Your program needs an equipment review.” Each uses the actual PrimeRep notification title and the metadata label “Example.” These match backend `app/core/coach_notification_service.py:489–494`; its preference gate is at `:185–227` and `app/models/coach.py:105` defaults Coach notifications off. Frontend `app/settings.tsx:175–198,503–517` separately enables Coach reminders.
- Remove only demo timer/focus interval and fourth-card animation state, as approved for this presentation slice. Retain the three card entry timings, shared screen transition, and existing AnimatedButton press feedback.
- Use existing neutral theme tokens for illustrative bell tiles, explanatory copy, and Skip. Skip is an actual rendered Pressable after Enable in the same footer, with minimum 44-point dimensions, full available width, accessible name/state, and pressed feedback. Its surface and label follow appearance changes. The old route-owned header effect and `useNavigation` import are removed; `Stack.Screen` hides the shared inherited header action locally.
- Give each example a 40-point neutral bell tile beside a flexible text column. PrimeRep and Example stack vertically and use the full available column width. This is an approved adaptive hierarchy refinement following engineering review, not a claim that a native defect was observed.
- Place a growing minimum-56-point Enable action and naturally growing secondary Skip inside the content ScrollView, with bottom safe-area padding. Text and cards wrap naturally using existing system typography; no line limits, scaling caps, fixed text heights, or forced uppercase are added. Busy Enable uses a neutral surface while both actions retain real disabled/busy semantics.
- Change only this route and the `NOTIFICATIONS_SCREEN` object in shared constants. Neighboring constants, providers, push-token service, authentication, storage, OS request arguments, saved field, final route, dependency manifests, and shared components remain unchanged.

Exact Enable/Skip handler SHA256 remains `63bfe9003ab8e60b08a55c4ce6862fe87006c800f5cd453bb7e8d8c1089d1f61`. Revised route SHA256 is `d2c8bf3bb84b3c7a988de5ecd837ca289e54618a2b4a26f916d5002ead340067`; harness SHA256 is `7069b95c2b97b29269e29bd3666f36070429e281e975bd91282a236be2ed71bc`. Combined animation/handler pre-return SHA256 is now `8e5f518df4b7022a65b73077cd1834bf52c9e6b5b2c38093dfc1e9ca3e2f9330` because the header presentation effect was removed; retained motion SHA256 is `b25fc75a09b91740c54d40ef846ecc2df95e1774cdfcea39d573095c5ef5525e`, and the approved own copy remains `babfc505809a2c5570c016630fe0ac2313eebf43990c817dbb6ac4d37885ba5e`.

## Verification

- Original actual-screen baseline: **32 passed** across Light/Dark. The harness loads real Appearance, Onboarding, and Notifications providers, themes/hooks, ThemedView, AnimatedButton, and shared transition; native/router/auth/storage/push boundaries are mocked.
- Presentation expectations were added before production edits: **27 passed / 18 failed** on the original source. The 27 passes were 26 original cases plus the new exact-handler guard. Six original expectations were revised for approved copy, demo timer removal/static motion, and header appearance; those six failed, along with twelve new presentation cases. The pending label also follows approved casing. This is 32 original baseline cases and 45 final cases with approved presentation expectations revised, not all 32 unchanged verbatim.
- The predecessor focused suite passed **45 cases**, retaining permission success/denied/undetermined/provisional/ephemeral, OS/token/upload errors, busy and disabled controls, Skip, foreground revocation, web unsupported, Android channel/registration, draft persistence, unrelated data, and no Health payload. Those cases now use the actual rendered Skip, and the existing appearance/target checks inspect its live Text and Pressable style rather than an unmounted header callback. Only presentation expectations changed; permission business behavior did not.
- Two distinct footer regressions were added before production changes: both failed on predecessor `409fae70ae05e7f2ba83d679a13d9f915f71bfd2e1e35294d2ed9e3ce5b1e08d`, while its existing 45 cases passed. Revised focused tests pass **47/47**. Each theme proves Skip is actually inside the automatic-inset ScrollView/footer immediately after Enable, has a full-width growing 44-point minimum, natural unrestricted centered text, no fixed height/overflow, no imperative navigation-options writes, and a route-local null header action. These are structural regression checks, not native glyph certification.
- The existing adaptive-card case in each theme now checks the vertical title/metadata column, full flexible width, non-flex title, and 40-point bell tile. Both theme cases failed at the new header assertion before this refinement and pass afterward; no cases were added to inflate the count.
- Supplemental A→B/logout account probes pass with real NotificationsProvider/pushTokenService and mocked OS/storage/HTTP boundaries; they are recorded in `/private/tmp/u28-independent-verification.uyh0wp/account-probe.log` and excluded from 47/679/680. No real OS permission prompt was exercised.
- Fresh independent final engineering GO at `/private/tmp/u28-footer-independent.o0UBGR/REPORT.json` verifies this exact route/controller/handler/harness/copy freeze: **47 focused / 679 named core / 680 standard**, with the audit runner counted once. Types, zero-warning scoped lint, interaction audit/self-tests and diff checks pass; normal Expo lint has zero errors and the two inherited warnings. It confirms all 575 other tracked files, neighboring constants, and shared parent layout remain byte-identical to base. The earlier engineering pass on source 409 did not certify native header fit; the native clipping finding required this footer revision.
- Revised named core suite excluding the audit runner: **679 passed**. Standard `node --test scripts/test-*.mjs`: **680 passed**, including the UI-audit wrapper once as one discovered test, not as a second set of separately counted regression cases. The focused 47 cases are included in those totals.
- Typecheck, scoped lint, UI interaction audit, and diff check pass. Normal Expo lint has **0 errors / 2 inherited warnings** in `components/animated-checkmark.tsx:34` and `components/hero-neon-line.tsx:60`.
- Contrast on active/readable token pairings: Light helper **5.04:1**, Dark canvas helper **6.89:1**, Dark card metadata **6.31:1**, and white/purple action **5.19:1**. The inactive disabled/busy label is **4.00:1 Light / 4.36:1 Dark** and exempt from the ordinary active-control threshold; this does not claim every state exceeds 4.5:1.
- Revised fresh cache-cleared Expo web export with `EXPO_NO_DOTENV=1` and temporary HTTPS API `https://api.primerep.invalid` generates **62 actual HTML files**. Emitted `entry-308389f36466c8296606d6658d782acf.js` (SHA256 `1ec20fefb946e8c98382e349284bbb79bf014e3b02ae51abc87b7d7f1518c12f`) contains fifteen own selector/copy/API markers, including the new scroll/footer Skip markers. Its route-local null header and footer Enable-before-Skip order are also verified. This confirms compiler/artifact output, not native glyph fit or permission-flow results.
- Independent cache-cleared, dotenv-disabled export produces **62 actual HTML files**, verifying sixteen decoded selector/copy/API markers plus the local null header and Enable-before-Skip order. Entry `entry-e7c074c6139fb89b499dac09d3609550.js` has SHA256 `7b6c78d5b40a62112cea2ae960ca6c5854132b96cacd789d6d0979a170e0d20c` and the unique HTTPS API `https://u28-footer-independent-api.invalid`. Compiler results do not certify native actions or OS permissions.

Raw local evidence is under `/private/tmp/primerep-u28-baseline-wrHZCR/`. Revised footer logs are `skip-footer-before.log` (45 pass/2 fail before production edits), `skip-footer-focused.log`, `skip-footer-core.log`, `skip-footer-standard.log`, `skip-footer-types.log`, `skip-footer-scoped-lint.log`, `skip-footer-expo-lint.log`, `skip-footer-audit.log`, and `skip-footer-export.log`; the exported artifact is `skip-footer-web`. The standard log contains the audit self-test runner exactly once. Original `baseline-notifications.log`/`presentation-before.log` and earlier `*-header-final.log`/`header-delta-before.log` files are historical predecessor evidence.

## Final native evidence and limits

Genuine original Light/Dark initial captures were inspected before implementation on authorized device `C3D67687-978B-4319-80AF-26BB0A56B525`. The original route matched SHA256 `35b25abf2cb3ac6ae0e722c033afcec48e1fc5fc6d2691fa3b5bb76c30bc65b7` immediately before each screenshot. The inherited large text setting was retained. Neither Enable nor Skip was tapped; no OS permission prompt or account action occurred. C3 was restored to its empty Signup Light surface, keyboard closed, on unchanged usual Metro 8081.

Genuine original assets:

| Asset | State | SHA256 |
| --- | --- | --- |
| `u28-before-light-large-initial.png` | Genuine original initial screen; inherited large text | `3625df9eb6970aa680e757848e66631463b186062227c456fffcac32fae4bb48` |
| `u28-before-dark-large-initial.png` | Genuine original initial screen; inherited large text | `e796c3a28c21283ccbbfa01e4b0aa11fe104ace91a5615e62bcbbbfd1cb3418c` |

Predecessor source `409fae70ae05e7f2ba83d679a13d9f915f71bfd2e1e35294d2ed9e3ce5b1e08d` subsequently passed only two normal-text native configurations. Those private predecessor captures are not revised-source AFTER evidence. Its Dark maximum-text inspection at `/private/tmp/primerep-u28-native-RYQSN4/u28-after-dark-max-top.png` visibly clips the route's own Skip label inside the fixed header. A five-configuration native pass is not claimed for that predecessor; testing stopped for this scoped footer fix.

All five fresh cold native configurations pass on final source `d2c8bf3bb84b3c7a988de5ecd837ca289e54618a2b4a26f916d5002ead340067`: A21 Light/large, Dark/large, Light/MAX, Dark/MAX, and compact Light/large. Every case is read-only: public routes, assertions, scrolling and captures. Neither Enable nor Skip was tapped, and no OS permission, input, selection, account submission or Health action occurred. Permission success/refusal/failure/busy/Skip/persistence and account behavior remain actual-screen/provider harness evidence with mocked boundaries, not native permission certification.

Actual native Enable/Skip targets measure 382×56/382×44 points in both normal themes, 382×169/382×86 in both MAX themes, and 327×56/327×44 on compact. Hierarchies verify the names Enable notifications and Skip notifications, enabled state, and the absence of an inherited header Skip. Both MAX action glyphs are complete above the home indicator; the three examples retain their stacked PrimeRep/Example labels. Private overlapping MAX companions show the uncapped heading, account/Settings condition, example-only clarification and all three messages. The maximum page does not fit one image; bottom captures alone are not whole-page proof. Compact requires scrolling.

Exactly nine canonical PNG files contain two original BEFORE and seven fresh final-source AFTER captures, all visually accepted and byte-identical to raw originals (9/9). Normal initial and bottom pairs intentionally have identical bytes because the content fits their viewport. All final captures and post-run source checks match the frozen source; source-409 diagnostic images remain private and are not any final AFTER file. Complete dimensions, hashes, device IDs and comparisons are in the immutable screenshot README and `/private/tmp/primerep-u28-native-final-2gwaxd/capture-provenance.json`.

The final native runtime returns HTTP 200 for the actual SDK54 manifest and advertised iOS launch asset, with the owned project root, final selectors/copy and approved LAN API. The existing development binary was reused without installation or rebuild. After testing, both guests were restored through public development-client URLs to usual Metro 8081 in Light/large with keyboard closed: A21 retains empty Custom, three days, Large Gym and PrimeRep Optimized; compact is at empty Signup. The owner then stopped only its authorized session 9280/PID2416; port 8083 was free and usual 8081/8000/8082 listeners remained intact.

No physical-device, Android, VoiceOver audio, OS Reduce Motion, native animation frame timing, actual permission grant/refusal/revocation, notification delivery or busy-state native transition is claimed. These UI checks do not close production or Health release gates.

## Known behavior and rollout

Existing behavior is preserved: OS grant followed by token/upload failure can save a false onboarding flag; failures silently advance; foreground revocation updates provider permission without rewriting the onboarding draft; Skip does not revoke OS access or unregister tokens. This slice does not fix those behaviors or introduce a shared reduced-motion change.

No backend, migration, installation, font, or dependency version change is required. Native preparation replaced only the owned worktree's dependency symlink with an APFS clone of the existing installed tree, matching Expo `54.0.25` and CLI `54.0.16`; the resulting local directory is ignored. Source, harness, own copy, manifests and lockfile were unchanged by preparation. Engineering and read-only native evidence are complete for independent base `6ffc2364bf5203127b71829f4c527583b6063460`; this does not claim current-main composition or GitHub CI results. Prepared for review; no automatic merge is planned.

## More screenshot evidence

The two Dark comparisons appear immediately below the summary. The remaining seven files below retain exact canonical names. All images and the provenance README use the full immutable asset commit SHA.

<details>
<summary>Original Light/large and final Light/large on different 16 Plus guests</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-before-light-large-initial.png" width="320" alt="Genuine original Light/large notification onboarding on C3 before presentation changes" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-light-initial.png" width="320" alt="Final Light/large notification onboarding on the separate A21 guest with three illustrative examples and footer actions" />

</details>

<details>
<summary>Complete normal Light/Dark actions; identical to each theme's initial capture</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-light-bottom.png" width="320" alt="Final Light/large full Enable and Skip footer; content fits the viewport so this raw image is identical to the Light initial capture" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-dark-bottom.png" width="320" alt="Final Dark/large full Enable and Skip footer; content fits the viewport so this raw image is identical to the Dark initial capture" />

</details>

<details>
<summary>Fresh cold MAX Light/Dark and compact Light footer reach</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-light-max-bottom.png" width="320" alt="Final cold Light/MAX with complete naturally grown two-line Enable and neutral Skip glyphs above the home indicator" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-dark-max-bottom.png" width="320" alt="Final cold Dark/MAX with complete naturally grown two-line Enable and neutral Skip glyphs above the home indicator" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/u28-after-compact-light-bottom.png" width="320" alt="Final compact Light/large after scrolling, with wrapped illustrative copy and both intact footer actions" />

</details>

[Screenshot provenance, measured native matrix, cleanup and reproduction](https://github.com/DiegoZG/PrimeRep-AI/blob/c36a435226959d829fe7048779652af343664a2f/docs/pr-screenshots/u28/README.md)

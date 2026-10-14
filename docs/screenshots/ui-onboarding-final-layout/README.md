# U51 — Final onboarding layout

The final onboarding screen keeps its existing copy and account routes, but uses a calmer hierarchy and one growing scroll surface. Purple remains on Create account; the existing-account action is neutral. Both controls retain shared press feedback, named button semantics and uncapped text. The redundant Skip-to-this-same-screen control is removed; inherited Back is unchanged.

## Matched simulator views

Five configurations are compared: iPhone 16 Plus Light/Dark at `large`, iPhone 16 Plus Light/Dark at `accessibility-extra-extra-extra-large` (MAX), and iPhone SE 3 Light at MAX. The 14 unaltered images comprise five original initials, five candidate initials, three separate candidate scrolled-action views and one SE middle-description supplement.

| Configuration | Original initial | Candidate initial | Candidate scrolled actions |
| --- | --- | --- | --- |
| Plus Light, large | [Before](u51-before-plus-light-large.png) | [After](u51-after-plus-light-large.png) | Not needed |
| Plus Dark, large | [Before](u51-before-plus-dark-large.png) | [After](u51-after-plus-dark-large.png) | Not needed |
| Plus Light, MAX | [Before](u51-before-plus-light-max.png) | [After — initial](u51-after-plus-light-max.png) | [After — scrolled](u51-after-plus-light-max-footer.png) |
| Plus Dark, MAX | [Before](u51-before-plus-dark-max.png) | [After — initial](u51-after-plus-dark-max.png) | [After — scrolled](u51-after-plus-dark-max-footer.png) |
| SE Light, MAX | [Before](u51-before-compact-light-max.png) | [After — initial](u51-after-compact-light-max.png) | [After — scrolled](u51-after-compact-light-max-footer.png) |

[SE MAX — scrolled middle description](u51-after-compact-light-max-description.png) complements its initial and action frames; it is not a sixth configuration or a 100%-description-in-one-frame claim.

MAX initial and scrolled frames show different viewport positions: large text naturally continues below the initial viewport, and the scrolled views show the account actions. They are not composited into one screen. A whole oversized text block need not fit a viewport; normal scrolling must make the content and controls reachable.

## Baseline and runtime provenance

Base: `78c6d0cd1f7a3e182fb19b75b0a8e1e9205286b2`. Original Final bytes exactly match main, but those original views were served by the existing U50b runtime. This is an exact Final-route baseline, not an entirely clean-main app.

| Source | SHA-256 |
| --- | --- |
| Original Final | `7e66f18afbb4b5e6f9e76e8bfaa6764f01079985f31230fe68e1bac1edfedd9b` |
| Candidate Final | `5770c60ab0c16241b30a9b5f401af2daa9823342c69becd5711d14721d0267db` |
| Candidate Final tests | `3f2b2b36af795921fea56c525237304ca790b0a687b4f1275b2e0ecbdd1088fc` |

The same existing custom SDK 54 binary, bundle `com.diegozegarra.primerep`, is used on iOS 18.5; Expo Go cannot provide this app’s existing HealthKit module. No native build or install is required for this UI-only change. The temporary development runtime advertises localhost but binds LAN-visible; this uses previously approved temporary development-bundle exposure, not a loopback-only claim. The fixture API remains closed and guest-only views require no backend.

The source/SDK manifest and advertised development asset returned HTTP 200 with the expected root and four Final IDs. The recorded flow [onboarding-final-layout-refinement.yaml](onboarding-final-layout-refinement.yaml) is byte-identical to the native owner’s packaged reproduction flow (SHA-256 `c7df2534ffc244bcc9081a1bfd1bd9bddac7dddc15805fb24e1ad616f31b9097`). It combines the actual executed initial-identity, scrolled-footer and description helper modes; no extra execution of the combined reproduction file is claimed. The description PNG was captured directly after its helper flow. Callers must establish the recorded OS configuration, guest runtime and public Final route first.

Root accepted native cleanup: owned session 48908 / PID 51656 exited successfully, the PID is gone and port 8083 is free. Protected usual frontend/backend services remain unchanged; fixture API port 8001 remains closed. Both fictional guests are restored through the public usual-8081 route to Light/large, empty First name and no keyboard. No typing, logout, reset or preference assignment was used. Cleanup screenshots and app trees remain private, outside these 14 canonical images.

## Honest diagnostics and boundaries

One original pan did not move the non-scrollable content. The SE original post-capture title guard failed where the original title was clipped; that genuine captured before view is not treated as a passing reachability assertion. The candidate scrolled frames are separate evidence, not repaired original captures.

No Create account or existing-account action was tapped during this native capture slice. Routes, repeated presses, Back-option inheritance and restored onboarding data are covered by render tests, not a claimed native account-flow test. Native hierarchy checks are not VoiceOver audio certification. No physical-device or GitHub CI certification is claimed.

Both complete account actions are visible together in each MAX scrolled frame. Plus description is covered by overlapping initial/action frames. SE initial/action endpoints alone miss middle text, so root authorized one bounded description supplement. Its 95% visibility assertion passed; the last line extends 20 points below that viewport and its ending is complemented by the action frame. The three SE frames cover the content across viewport positions, not one whole-description view.

The fictional Plus retains Varied and the SE remains unset; no choice reset, account action, auth/Health/notification permission or private app-container operation is needed. Guest-provider startup may reserialize an unchanged draft; this is not a zero-storage-effect claim.

## Engineering verification

- Author standalone: Final 18/18, focused onboarding 340/340, full suite 1,021/1,021.
- Author mechanical U50b + U51 composition: full suite 1,029/1,029. Six frozen files were copied into an independent baseline clone, without a Git merge or feature-clone edits.
- Independent execution: Final 18/18; selected onboarding/account regressions 346/346 standalone and 354/354 composed. Full 1,021/1,029 logs were reviewed and hash-validated, not independently rerun.
- Typecheck, scoped lint, UI-action audit/self-tests and diff checks pass. Normal lint has zero errors and two inherited hook-dependency warnings.
- Fresh clear HTTPS web exports yield 62 HTML routes. Decoded source maps prove exact current Final, Provider, Button and Text sources and complete emitted modules; independent emitted module bytes match the author’s export.

Render tests assert complete copy, stable account callbacks, unchanged springs and Provider behavior, named controls, safe-area padding, one growing scroll, natural wrapping and absence of font caps. Width/font-scale/inset matrices are source-property checks, not native glyph measurements. SSR verifies named roles and keyboard focusability, not complete browser interaction.

No backend, storage, migration, permission, shared component, dependency or theme change is included. Part 10 and production/legal release gates remain separate.

## Unaltered capture hashes

Plus PNGs are 1290 × 2796; SE PNGs are 750 × 1334.

| File | SHA-256 |
| --- | --- |
| `u51-before-plus-light-large.png` | `f2f8278d40181adfa5fd4de7ad537508d98ccc51a80c411f4491768580187467` |
| `u51-after-plus-light-large.png` | `a1d886e5d378e7e2906b605a07d26d7760f8136b58f6a45f0670adbf196facfa` |
| `u51-before-plus-dark-large.png` | `27dad63cd416ff7fb9792a5f7c68aff63a3f2192a8c88bbea40804672e6f0460` |
| `u51-after-plus-dark-large.png` | `6d3a106324ed90c3c62210e5d1bba7bbc5288dc862937aa6ee9ef1ed62b01111` |
| `u51-before-plus-light-max.png` | `bf93ce4bfd2c5196327f23dff766e5ee53b00bcc4162f55f135f9469411df6ed` |
| `u51-after-plus-light-max.png` | `80099a79cf227d862247381679038058b56c1b79ad75e2f333888695a75addd6` |
| `u51-before-plus-dark-max.png` | `5d9ef68335fa92b4ae51e10bb2079c7b7e6af5d760058e0cfca253e6044930db` |
| `u51-after-plus-dark-max.png` | `e7ac28a45720ac59f7cd88618221fbeda08996d1568c050ab0af56cfb40f1365` |
| `u51-before-compact-light-max.png` | `79659ca0436b52170cb79a329b36e33339fb30bee38d90b2cb1ee8b5e2928a77` |
| `u51-after-compact-light-max.png` | `f60e2fd19fe478a81e1bdc67de9476216a405970835bd865846e9fb1355d76c7` |
| `u51-after-plus-light-max-footer.png` | `0d6cd3bff9472c37c8bdbba9ba875afafdec0cdc02cc7a9f89f8344b88f6ed7e` |
| `u51-after-plus-dark-max-footer.png` | `7533b55c9b9a4e927f5567088f3923c32403706506d9e5c1bae9c126780693ab` |
| `u51-after-compact-light-max-footer.png` | `42bc1dbcd1193853b7bde642bbe4077c893872978e55267f1b8afb71c140dcb2` |
| `u51-after-compact-light-max-description.png` | `c5bf616a8325450e528be014315f48c546ec2b3a18456df532fc9c100b57dcf5` |

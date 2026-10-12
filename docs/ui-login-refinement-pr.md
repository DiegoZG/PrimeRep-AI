# Refine Login with calmer inputs and accessible controls

## Changes

- Keep the existing welcome copy and form order; concentrate purple on Sign in.
- Give Email and Password persistent labels, neutral input surfaces and focused borders, and a readable 44-point password-visibility control.
- Make recovery, signup and onboarding links neutral, comfortably tappable and wrap-safe.
- Keep both safe-area edges, add a keyboard-aware scrolling form, and support outside-tap and drag dismissal without losing entered values.
- Scope the shared input presentation to Login through an optional, false-default `authPresentation` prop; other callers retain their existing appearance.

## Behavior and boundaries

The login controller, exact validation and error messages, email trimming, original password value, pending state and root-managed routing remain unchanged. Password visibility, recovery/signup destinations and the password-updated notice remain available. No API, authentication, data, storage, Health, dependency or shared-theme change is intended.

## Verification

- Focused Login harness: 18/18 passing, including the 10 baseline checks retained from before presentation changes.
- Combined regression suite: 396/396 distinct tests passing (378 existing tests plus 18 Login checks); audit self-tests run separately.
- Lint, typecheck, UI-action audit and audit self-tests pass. HTTPS-configured web export succeeds for 62 routes; diff checks pass.
- Native iPhone 16 Plus checks pass in both normal-size themes. The focused Dark input uses a neutral border without the old cyan halo, and empty-form validation remains readable and semantic.
- Outside tapping and dragging dismiss the keyboard while retaining an agent-owned invalid draft. Password visibility responds on the first tap with the keyboard open; Sign in also responds on the first tap and shows the unchanged local invalid-email error without making an authentication request.
- Login layout and scrolling were inspected at maximum text in both themes; every Login control remains reachable. An isolated 375-point Light guest simulator also passes the compact-layout inspection: visibility is 52×56, recovery 132×44, Sign in 327×52, signup 67×44, and onboarding return 327×44 points.
- The focused normal-size Maestro flow completed with exit 0 in three runs: iPhone 16 Plus Light, iPhone 16 Plus Dark, and compact Light. Read-only maximum-text Login layout/capture flows also completed with exit 0 in both themes.
- The broader maximum-text flow did not complete at the existing Forgot-password Back-return step. That is a separate recovery-screen follow-up, not a passing maximum-text end-to-end result or a confirmed Login defect.
- Both newly isolated guest simulators were restored and read back as OS Light, standard large content size, empty Login fields, hidden password and closed keyboard. Existing authenticated apps and their saved workout data were untouched.
- Historical shared-input host-tree comparison covers omitted/false opt-in, focus, blur, errors and original callbacks in both themes.
- Successful authentication and backend-failure states are exercised with mocked service calls; no credentials or account writes are required for this presentation pass.
- Independent review reran 18 focused and 396 combined checks, lint, typecheck, audits and export; it also verified every other shared-input caller is byte-identical to main.

### Remaining manual checks

Real successful authentication, credential autofill/password-manager behavior, VoiceOver and a physical iPhone are not claimed by this styling pass. Submitting/backend failure and reset-success states are covered by the focused service-mocked harness. The existing authentication controller, including its current request/routing behavior, is intentionally not rewritten here.

All in-scope native checks above are complete; these explicitly named manual and separate recovery follow-ups remain open.

The existing recovery screen's maximum-text return action needs a focused U48 follow-up to reproduce the interrupted broader flow and establish its cause. No recovery source was changed, and this observation does not reclassify that screen as requiring a redesign.

## Screenshots

Four genuine before captures are approved: normal Light, normal Dark, Dark focused keyboard, and Dark maximum text. The maximum-text baseline placed lower actions outside a non-scrolling form; it is not evidence of title overlap. Seven original after captures are approved: normal Light, normal Dark, Dark focused keyboard, Dark local empty-form validation, Light compact width, and maximum-text action views in both themes. Each copied original matches its capture byte-for-byte. Maximum-text screenshots show the actions at a later scroll position, not all fields at once. Published screenshots will use immutable full-commit URLs and truthful before/after labels.

After · Light theme

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-light.png" width="320" alt="Login after, Light theme" />

After · Dark theme

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-dark.png" width="320" alt="Login after, Dark theme" />

<details>
<summary>Before · normal Light and Dark</summary>

Before · Light theme

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-before-light.png" width="320" alt="Login before, Light theme" />

Before · Dark theme

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-before-dark.png" width="320" alt="Login before, Dark theme" />

</details>

<details>
<summary>Keyboard, validation and large-text captures</summary>

Before · Dark focused keyboard

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-before-dark-focus.png" width="320" alt="Login before, Dark focused input" />

After · Dark focused keyboard

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-dark-focus.png" width="320" alt="Login after, Dark focused input" />

After · Dark local empty-form validation

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-dark-validation.png" width="320" alt="Login after, local empty-form validation" />

Before · Dark maximum text

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-before-dark-max.png" width="320" alt="Login before, Dark maximum text" />

After · Dark maximum text, actions at a later scroll position

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-dark-max-actions.png" width="320" alt="Login after, Dark maximum-text actions" />

After · Light maximum text, actions at a later scroll position

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-light-max-actions.png" width="320" alt="Login after, Light maximum-text actions" />

After · Light compact 375-point width

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/ASSET_COMMIT/docs/pr-screenshots/u14/u14-after-light-compact.png" width="320" alt="Login after, Light compact width" />

</details>

## Dependencies and rollout

Frontend-only slice based on merged Exercise detail PR #63 (`4bbabb8114191e59119a0a34513a92f5ac43c34b`). This does not close separate production or Health release gates. Signup is the next separately reviewed slice; no automatic merge is authorized.

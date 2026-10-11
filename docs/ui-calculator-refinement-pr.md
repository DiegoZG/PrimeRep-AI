# Fix calculator contrast and clarify estimate actions

The onboarding one-rep max calculator used white text on cyan for Apply
(1.77:1 contrast), and both the estimate and Calculate competed with the final
action. Apply now uses the existing purple primary color with white text
(5.19:1); the estimate uses a neutral panel and primary text, and Calculate
becomes a neutral secondary action once an estimate exists.

## Screenshots

After-only native iPhone SE simulator captures (375-point width, normal text).
Each theme shows two separate scroll positions: the estimate, then the selected
Apply action. These are original captures, not a stitched screen. Native BEFORE
captures were not taken. Tap a preview to open its full-size image.

### Light — estimate

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/light-result.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/light-result.png" alt="Calculator after refinement in light mode, estimate scroll position" width="320"></a>

### Light — Apply action

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/light-apply.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/light-apply.png" alt="Calculator after refinement in light mode, selected Apply action" width="320"></a>

### Dark — estimate

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/dark-result.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/dark-result.png" alt="Calculator after refinement in dark mode, estimate scroll position" width="320"></a>

### Dark — Apply action

<a href="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/dark-apply.png"><img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/8b30918e36065170f1dae8ba19a551c354030388/docs/pr-screenshots/u01/dark-apply.png" alt="Calculator after refinement in dark mode, selected Apply action" width="320"></a>

## Changes

- Keep system typography and existing light/dark theme tokens; use readable
  muted text for instructions and units, and primary text for saved values.
- Stack input labels, allow exercise/action text to wrap, and give actual
  controls minimum 44-point targets (48 points for Calculate/Apply).
- Keep modal content scrollable inside keyboard avoidance, with drag/outside
  keyboard dismissal and handled taps so actions remain reachable. Calculate
  dismisses the keyboard to make room for the estimate and exercise choices.
- Name inputs and exercise actions, expose selected/disabled state and the
  accessible result label, and add an explicit neutral Cancel action using the
  existing back-navigation contract.
- Display the existing LB/KG unit in Apply instead of hardcoded `lb`.

The parser, percentage table, rounding, exercise assignment, last-result-until-
recalculate behavior, invalid-result clearing, and onboarding numeric values
are unchanged. No shared component, global theme, backend, permissions,
analytics, dependencies, or Health behavior changes.

## Verification

- `node --test scripts/test-calculator-ui.mjs`: 18/18 passed. Covers light/dark
  action hierarchy and contrast, real control style targets and names,
  decimal weights, LB/KG presentation, each of the three Apply destinations,
  rep boundaries/invalid-result clearing, delayed recalculation, and Cancel/
  backdrop navigation without context writes.
- `npm run lint`: passed.
- `npm run typecheck`: passed (new native ScrollView import).
- `npm run audit:ui-actions`: passed.
- `npm run test:audit-ui-actions`: passed.
- `git diff --check`: passed.
- `EXPO_PUBLIC_API_URL=https://api.primerep.example npx expo export --platform
  web --output-dir <temporary-directory>`: passed; 62 static routes exported to
  `/private/tmp/u01-calculator-web-RJY6hT`. Existing notifications web-listener
  warning does not prevent export.
- `.maestro/onboarding-calculator-layout.yaml`: passed on an isolated guest
  iPhone SE (375-point width), iOS 18.5, in light and dark mode at normal text
  size. Verified empty/disabled state, first-tap Calculate with the numeric
  keyboard open (which then closes), `100.5 × 5 → 113 lb`, neutral result,
  Bench Press selection, visible `Apply 113 lb to Bench Press`, and Cancel
  return without applying. Existing authenticated simulators retain their
  active workouts; no account/storage/Health reset was used to reach onboarding.
- After screenshots for empty form, keyboard, result, and Apply are recorded
  under `/private/tmp/u01-calculator-light-normal-final2/screenshots/` and
  `/private/tmp/u01-calculator-dark-normal/screenshots/`. Normal-size result/
  action screenshots were visually inspected in both themes.
- Native calculator BEFORE screenshots were not captured; the defect baseline
  is the unchanged screen source at `37c811f` and its measured color contrast.

`react-test-renderer` emits its existing deprecation notice. These focused tests
inspect rendered props and callbacks; they do not prove native layout, touch
dispatch, VoiceOver focus, or keyboard behavior.

## Native verification path and remaining gaps

Manually open an empty calculator from the one-rep max screen on a dedicated
guest simulator, then run
`maestro test -e UNIT=lb .maestro/onboarding-calculator-layout.yaml` (or `kg`
for the existing KG unit). The flow captures empty form, keyboard, estimate and
selected Apply, then cancels without saving. Repeat light/dark at normal and
maximum accessibility text size on a small supported iPhone; inspect wrapped
labels/actions and first-tap Calculate. Restore the original appearance/text.

Maximum accessibility text reachability, native Apply/result transfer to the
parent strength screen, native KG display, physical iPhone interaction,
VoiceOver names/traversal/announcements/modal entry and return focus, hardware
keyboard, and long/localized labels remain unverified manual checks. The native
flow inspects the Apply affordance but cancels instead of saving. Component
tests cover LB/KG and all three exercise writes; they do not close these native
gaps. Android device verification is not claimed.
The shared AnimatedInput focus glow and numeric keyboard/parser contract remain
the existing behavior for separate approved input work.

## Dependencies and rollout

Based on frontend `origin/main` at `37c811f`, including the accepted Health
refinement (#49). This is U01 only; other screens remain separate PRs. It needs
no API release, migration, or new runtime configuration. Reverting this PR
restores the previous presentation without a data rollback. Open as a draft
PR while the listed manual checks remain pending. Do not merge automatically;
complete the native/manual checks before rollout.

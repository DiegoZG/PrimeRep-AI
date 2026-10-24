# Trainer-led and time-budget workouts

Generated workouts now offer **Trainer-led** or a maximum time budget of
25, 35, 45, 60, 75, 90, 105, or 120 minutes. Trainer-led leads with exercises
and targets; its approximate duration is available under Workout details.
The estimate is separate from the budget, and longer budgets do not add
exercises solely to fill the available time.

New accounts default to Trainer-led. Existing accounts without the new fields
retain timed planning with a 35-minute default and their stored day durations.
Settings saves an account preference independently from the other training
fields, then offers Keep current plan or Update remaining workouts. A day-level
change affects only that day. Started, completed, historical, and program
workouts retain their plans. Planning also locks on returning to a cached
overview immediately after starting a workout.

## API dependency and rollout

Deploy backend [PR #29](https://github.com/DiegoZG/PrimeRep-AI-Backend/pull/29)
before distributing this client. No new database table or migration is needed.
Existing duration endpoints and fields remain compatible with older clients.

- Account defaults: `workoutPlanningMode` and `preferredWorkoutMinutes` through
  the training-preferences endpoints. The dedicated Settings save uses
  `planUpdateScope=preserve`; saving alone does not rewrite the current plan.
- Per-day planning: `PATCH /v1/workouts/week/planning`, including the mode,
  nullable budget, workout ID, week, and effective local date.
- Explicit application: `POST /v1/workouts/week/apply-planning-preference`.
  Server schedule locking protects sessions that start concurrently.
- Workout metadata distinguishes mode, budget, calculated estimate, default
  versus override, and server editability. Unknown mutation outcomes require
  an authoritative refresh before another workout can start.

## Automated verification

The focused planning, overview, Settings, home, and player suite passed
**147 tests**:

```sh
node --test scripts/test-workout-detail-ui.mjs scripts/test-training-preferences-ui.mjs scripts/test-home-ui.mjs scripts/test-workout-planning.mjs scripts/test-workout-arrangement-player.mjs
npx tsc --noEmit
```

Related workout storage, arrangement, set entry/status, settings, summary,
history, corrections, and onboarding regressions passed **205 tests**:

```sh
node --test scripts/test-workout-arrangement-store.mjs scripts/test-workout-arrangement-ui.mjs scripts/test-workout-set-entries.mjs scripts/test-workout-set-status.mjs scripts/test-settings-ui.mjs scripts/test-workout-summary-ui.mjs scripts/test-workout-history-ui.mjs scripts/test-workout-correction-ui.mjs scripts/test-onboarding-final-ui.mjs
```

The separate legacy `scripts/test-workout-feedback-ui.mjs` harness has 33
pre-existing failures: its mocks reject the already-present
`WorkoutArrangementSheets` import and its controller-pinning assertion predates
the merged arrangement feature. Running that harness against the unchanged
pre-feature `main` active-workout source (`9600321`) reproduced all 33 failures.
Those failures are separate from the passing counts above; this verification
does not claim that every repository test suite passes.

Focused ESLint on changed TypeScript source passed with zero errors and zero
warnings. Expo web export passed for **62 routes**. The local worktree reused
ignored dependencies with a temporary resolver preload:

```sh
EXPO_NO_METRO_WORKSPACE_ROOT=1 NODE_OPTIONS=--require=/private/tmp/primerep-workout-planning-metro-preload.cjs EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --clear --output-dir /private/tmp/primerep-planning-web-export-final
```

The preload, environment files, credentials, disposable fixtures, and runtime
bundles are not included in this change.

## Independent runtime verification

Verification used fictional accounts in an isolated PostgreSQL database and
an iPhone 16e simulator running iOS 18.5 at 390 × 844 points. The existing user
simulator and its services/database were left unchanged.

| Scenario | Observed result |
| --- | --- |
| Actual signup versus legacy profile | New account returned Trainer-led; a legacy profile without planning fields returned time-budget/35 minutes. |
| Trainer-led overview | Six exercises, no time budget, approximate 50-minute estimate hidden until Workout details opens. |
| Native 120-minute change | Confirmation rebuilt only the chosen day. The other six days and saved Trainer-led default were unchanged; no session was created. |
| Long budgets | Independent HTTP checks for 75/90/105/120 minutes retained the same complete six-exercise plan rather than adding filler. |
| Dedicated Settings save / Keep | Saved time-budget/90; the entire existing week remained identical. An unsaved General fitness choice stayed visible and was not submitted. |
| Explicit Apply | Native UI updated two remaining unstarted days; the five past days stayed identical. Separate HTTP checks also covered current and future weeks. |
| Active workout protection | A real native session with one synced set and 21 target rows survived Settings Apply. Server snapshots, targets, saved set, and start time remained unchanged; elapsed time advanced naturally. |
| Native persistence | SQLite retained the exercise cursor, immutable/effective workout, rest context, 120-second rest duration, and absolute rest deadline exactly; no operations remained pending. |
| Cold restart | Restored the same exercise and 1/21 saved-set state; Settings retained Trainer-led and its remembered 90-minute budget. |
| Cached started overview | From an editable fresh overview, Start → Keep Workout Active returned directly to a disabled planning control and explanation, without Home navigation or an in-app week refresh. |
| Maximum accessibility text | After a cold launch in dark mode at accessibility-extra-extra-extra-large, mode cards scrolled naturally; 120 minutes remained readable and selectable, with Close and Apply available. |
| Default preset | Switching an approximately 50-minute Trainer-led day to Time budget initially selected the visible 35-minute preset; cancelling left Trainer-led unchanged. |

Local Maestro runs used private fixture inputs through this sanitizing runner;
the flows and fixture credentials were intentionally kept outside the repo:

```sh
planning_qa_dir=/private/tmp/primerep-workout-planning-qa
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/overview-modes.yaml"
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/settings-keep.yaml"
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/settings-apply.yaml"
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/settings-protected-apply.yaml"
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/cached-start-lock.yaml"
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/cold-max-continue.yaml"
python3 "$planning_qa_dir/run-maestro.py" new "$planning_qa_dir/final-normal-handoff.yaml"
```

Both native test sessions were abandoned through the app's normal flow after
their evidence was captured. The final account has no active server session
or local active row and is left on its clean Trainer-led overview in light
mode with normal text. Standard workouts have no invented custom-muscle
rotation warning.

Android runtime, physical devices, a second-device UI session, full VoiceOver
gestures, and live browser interaction were not exercised. Maximum-text visual
verification used a cold launch; immediate in-place OS text-size changes are
not covered by the passing visual gate. Web verification covers the build and
mounted harnesses rather than a live browser flow.

## Captures

All captures show fictional data from the independent compact simulator.

- [Trainer-led overview](screenshots/workout-planning/ios-trainer-led.png)
- [120-minute time-budget sheet](screenshots/workout-planning/ios-time-budget-120-sheet.png)
- [Saved planning preference and retained unsaved training draft](screenshots/workout-planning/ios-settings.png)
- [Started workout planning lock](screenshots/workout-planning/ios-started-planning-locked.png)
- [Cold-launch dark mode at maximum text](screenshots/workout-planning/ios-dark-max-text.png)
- [Visible default time preset](screenshots/workout-planning/ios-default-time-preset.png)

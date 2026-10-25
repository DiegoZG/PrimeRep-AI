# Trainer-led and time-budget workouts

Generated workouts now offer **Trainer-led** or a maximum time budget of
25, 35, 45, 60, 75, 90, 105, or 120 minutes. Trainer-led leads with exercises
and targets; its approximate duration is available in the read-only Workout
information sheet opened with Info.
The estimate is separate from the budget, and longer budgets do not add
exercises solely to fill the available time.

New accounts default to Trainer-led. Existing accounts without the new fields
retain timed planning with a 35-minute default and their stored day durations.
Settings saves an account preference independently from the other training
fields, then offers Keep current plan or Update remaining workouts. A day-level
change affects only that day. Started, completed, historical, and program
workouts retain their plans. Planning also locks on returning to a cached
overview immediately after starting a workout.

The overview puts the exercise list first. Its compact toolbar contains the
planning mode, Add, and Info; the header shows the date and exercise count.
Info contains estimates, preparation/rest guidance, exercise-order help,
and any Coach or equipment-coverage details. Skip Day is in the header's
options menu. Exercise-order reset and error notices stay concise with
read-only Details, while an order-saved acknowledgement floats above Start
without moving the list. Dismissing a notice changes only its presentation.
Programs show a static Program label; started and protected workouts retain
their existing edit restrictions.

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
**178 tests**:

```sh
node --test scripts/test-workout-detail-ui.mjs scripts/test-training-preferences-ui.mjs scripts/test-home-ui.mjs scripts/test-workout-planning.mjs scripts/test-workout-arrangement-player.mjs scripts/test-workout-exercise-picker.mjs
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
warnings. Expo web export passed for **63 routes**. The local worktree reused
ignored dependencies with a temporary resolver preload:

```sh
EXPO_NO_METRO_WORKSPACE_ROOT=1 NODE_OPTIONS=--require=/private/tmp/primerep-workout-planning-metro-preload.cjs EXPO_PUBLIC_API_URL=https://api.example.invalid npx expo export --platform web --clear --output-dir /private/tmp/primerep-exercise-first-web-export
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

At the original planning-feature handoff, both native test sessions were
abandoned through the app's normal flow after
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
These planning and Add exercise captures predate the exercise-first toolbar
and Info sheet; current overview captures are recorded separately below.

- [Trainer-led overview](screenshots/workout-planning/ios-trainer-led.png)
- [120-minute time-budget sheet](screenshots/workout-planning/ios-time-budget-120-sheet.png)
- [Saved planning preference and retained unsaved training draft](screenshots/workout-planning/ios-settings.png)
- [Started workout planning lock](screenshots/workout-planning/ios-started-planning-locked.png)
- [Cold-launch dark mode at maximum text](screenshots/workout-planning/ios-dark-max-text.png)
- [Visible default time preset](screenshots/workout-planning/ios-default-time-preset.png)


## Add exercise verification

Unstarted generated workouts expose **Add** in the overview toolbar.
The searchable picker appends one exercise to this workout with 3 sets,
8–12 reps and 90 seconds of rest. Existing and reference-only entries are
visible but disabled. A timed workout that would exceed its budget requires
**Add anyway**; its original exercises and targets remain intact, and the
summary displays the actual estimate alongside the unchanged budget.

Independent verification used a new fictional Riley account, a separate
compact iPhone 16e / iOS 18.5 simulator, API port 8040 and Metro port 8090.
The user's existing simulator, account choices and active services were not
changed. Backend commit `4525fd6` passed 17 Add exercise tests and 26 planning
tests in separate acceptance suites; the frontend counts above include the picker and strict-prefix
saved-order recovery cases.

| Scenario | Actual result |
| --- | --- |
| Native addition | Riley's Trainer-led day increased from six to seven exercises. The new Leg Press was last with 3 × 8–12 / 90s; all six original exercises and prescriptions remained exact. |
| Saved user order | Moving Leg Extension before Glute Bridge survived adding the exercise and a cold app restart. The effective server session preserved that exact order and appended Leg Press last. |
| Start and logging | Start created seven exercises and 24 target sets. A set on the added exercise saved 10 reps / 40 lb (18.14 kg); a cold restart restored its synced status. |
| Search and duplicates | Native search, clearing and Back worked; already-added Glute Bridge was disabled. No keyboard dismissal tap was needed to select a result. |
| Timed cancellation | A separate 25-minute day previewed an addition above its budget. Cancel left the entire weekly API response identical. |
| Explicit timed addition | Add anyway appended Walking Lunge, preserved every prior block and all other days, retained the 25-minute cap, and displayed About 30 min · 25 min budget. |
| Protection | Native Add was disabled on the started day but remained available on another unstarted day. Independent HTTP checks rejected past/authored/active workouts, foreign private exercises, stale source lists and unsupported tracking. |
| Retry and session safety | HTTP duplicate retries were no-ops, no session was created by addition, and the newly added exercise was accepted by normal session creation and set logging. |
| Compact dark / maximum text | After a cold launch at accessibility-extra-extra-extra-large, search, clear and fixed Back remained reachable. Dragging content dismissed the keyboard; the disabled reference-only row and its multiline explanation scrolled into view. |

The live API oracle passed 16 behavior groups, including exact original
prescriptions, other days, preferences, source conflicts, privacy and atomic
budget confirmation. Native flow commands used private credentials through a
sanitizing wrapper; fixtures, logs and runtime helpers remain outside Git:

```sh
add_qa_dir=/private/tmp/primerep-add-exercise-qa
python3 "$add_qa_dir/run-maestro.py" new "$add_qa_dir/search-duplicate.yaml"
python3 "$add_qa_dir/run-maestro.py" new "$add_qa_dir/restart-start-log.yaml"
python3 "$add_qa_dir/run-maestro.py" new "$add_qa_dir/resume-lock-timed-cancel.yaml"
python3 "$add_qa_dir/run-maestro.py" new "$add_qa_dir/timed-confirm.yaml"
python3 "$add_qa_dir/run-maestro.py" new "$add_qa_dir/dark-max-visible-row.yaml"
python3 "$add_qa_dir/run-maestro.py" new "$add_qa_dir/normal-clean-handoff.yaml"
```

Maestro's iOS `hideKeyboard` can tap a catalog result; picker verification
kept the keyboard open or dragged the content to dismiss it. Lost-reply
recovery was verified by the mounted test harness, not by interrupting a live
native request. The existing Android, physical-device and VoiceOver limits
above also apply to this addition.

- [Native searchable picker](screenshots/workout-planning/ios-add-picker.png)
- [Truthful over-budget summary](screenshots/workout-planning/ios-added-over-budget.png)
- [Dark picker at maximum text](screenshots/workout-planning/ios-add-picker-dark-max.png)


## Exercise-first overview verification

The compact mode / Add / information toolbar puts exercises directly below
the title; workout options contain Skip Day. Facts, preparation, exercise-order
instructions, applicable coverage and protection explanations live in the
read-only information sheet. The prior QA-owned [overview capture](screenshots/workout-planning/ios-trainer-led.png)
provides the published before comparison. User-supplied reference screenshots
were used privately and are not included in repository assets.

Native verification used a new fictional Priya signup and another independent
iPhone 16e / iOS 18.5 simulator at 390 × 844 points, served by Metro 8091 with
the unchanged API on 8040. Existing Jamie and Riley accounts, devices, choices
and services were left untouched. The automated 178 focused / 205 related
checks, TypeScript, focused ESLint and 63-route web export passed for this UI.

| Scenario | Observed result |
| --- | --- |
| Normal Trainer-led geometry | Three complete exercise cards fit above the fixed Start footer without scrolling; mode, Add, information and More are visible. |
| Timed / reset geometry | An actual 35-minute rebuild with a saved prior order displayed the compact Exercise order reset / Details / Dismiss row and three complete cards above Start. |
| Information sheet | Estimated time, mode, focus, preparation and order instructions appeared after opening information. Empty equipment/rotation sections stayed absent. The long reset explanation appeared through Details. |
| Dismissal invariance | Closing information and dismissing the reset notice left the entire server week, preferences, favorites and scoped local order-storage bytes identical. |
| Order acknowledgement | Moving an exercise displayed Order saved above Start, then removed it automatically without moving the cards. |
| Planning / Add / favorites | The native 35-minute rebuild worked; the selected favorite persisted. Toolbar Add appended Bench Press after the chosen Leg Curl-first order and required explicit confirmation above the budget. The compact overview showed the truthful over-budget notice. |
| Real error and refresh | A concurrent change only to Priya's workout produced an actual stale-source response in the picker. Error / Refresh remained visible; returning to the overview blocked Start until an authoritative Refresh succeeded. |
| Started protection | A real five-exercise / 18-target session retained the exact selected effective order. Returning to its overview disabled mode and Add while information explained the lock. |
| Skip and overlay ownership | More closed before the existing Skip alert. Cancel preserved the plan; confirming Skip on another unstarted day removed that day ID and retained the active day's blocks exactly. Information, options, planning and confirmation were exercised sequentially without stacked overlays. |
| Dark / maximum text | A cold launch at accessibility-extra-extra-extra-large wrapped the toolbar naturally. Information kept its full-size title inside the scroll content and Close reachable while scrolling. More / Skip Cancel worked; planning's Time budget card and 120-minute preset scrolled into view, with Apply enabled and Close available. No maximum-text planning change was submitted. |

The native flow files and exact state comparisons remain private:

```sh
overview_qa_dir=/private/tmp/primerep-overview-design-qa
python3 "$overview_qa_dir/run-maestro.py" new "$overview_qa_dir/info-menu-order.yaml"
python3 "$overview_qa_dir/run-maestro.py" new "$overview_qa_dir/reset-dismiss.yaml"
python3 "$overview_qa_dir/run-maestro.py" new "$overview_qa_dir/add-order.yaml"
python3 "$overview_qa_dir/run-maestro.py" new "$overview_qa_dir/stale-add-barrier.yaml"
python3 "$overview_qa_dir/run-maestro.py" new "$overview_qa_dir/started-lock-skip.yaml"
python3 "$overview_qa_dir/run-maestro.py" new "$overview_qa_dir/dark-max-planning-continue.yaml"
```

Program and historical lock variants, accessibility-focus restoration and
pending confirmation dismissal were checked by mounted tests; the actual native
lock case used a started workout. Full VoiceOver gestures, Android, physical
devices and a live browser UI were not exercised. Maximum-text validation used
a cold app launch. No backend behavior or API contract changed in this UI slice.

These new captures contain only Priya's synthetic QA data:

- [Trainer-led exercise-first overview](screenshots/workout-planning/ios-overview-trainer.png)
- [Timed overview with compact order-reset notice](screenshots/workout-planning/ios-overview-timed-reset.png)
- [Read-only workout information](screenshots/workout-planning/ios-overview-info.png)
- [Dark information sheet at maximum text](screenshots/workout-planning/ios-overview-dark-max-info.png)

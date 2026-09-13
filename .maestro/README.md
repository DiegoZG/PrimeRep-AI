# PrimeRep-AI — Maestro E2E Tests

## Setup

### Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
brew install openjdk@17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

### App ID

Expo Go flows use `host.exp.Exponent`. Native-only flows use the configured
development-build identifier, `com.diegozegarra.primerep`, and the dedicated
`flows/auth-login-dev-build.yaml` authentication helper.

### Test Account

Each flow uses `testuser@primerep.com` / `StrongPass123`. Create this account once:

```bash
curl -X POST http://localhost:8000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@primerep.com","password":"StrongPass123","preferred_name":"Test","last_name":"User","legalAcceptance":{"accepted":true,"termsVersion":"2026-09-12","privacyVersion":"2026-09-12"}}'
```

Then complete onboarding via the app (equipment + workout split must be set for
workout generation to work).

### Backend

The app calls the backend at the `API_BASE_URL` set in `config/api.ts`. Start
it before running any flow:

```bash
cd ../primerep-backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

---

## Running Tests

```bash
# Single flow
maestro test .maestro/smoke-home.yaml

# All flows
maestro test .maestro/

# Debug mode (step through interactively)
maestro test --debug .maestro/smoke-home.yaml

# Interactive UI builder
maestro studio
```

---

## Test Inventory

| Flow | File | Tests |
|------|------|-------|
| Smoke: Home | `smoke-home.yaml` | Auth resolves, tab bar visible, workout cards load |
| Workout Browse | `workout-browse.yaml` | Tap workout card → workout detail with exercise list |
| Exercise Detail | `exercise-detail.yaml` | Workout detail → tap exercise → muscles, resolved equipment, and truthful demo status |
| Exercise Search | `exercise-search.yaml` | Explore tab search → results → clear |
| Workout Player | `workout-player.yaml` | Start Workout → confirm set → skip rest → jump via exercise sheet → finish → summary |
| Workout Editing | `workout-editing.yaml` | Confirm → edit → remove/undo a set, then save a workout note |
| Core Screen Completion | `core-screen-completion.yaml` | Forgot-password request, Coach shortcut, cleaned Explore, and Legal routes |
| Invalid Reset Link | `password-reset-link.yaml` | Deep link submission reaches the generic invalid/expired state |

---

## testID Inventory

Elements with `testID` props added for Maestro targeting:

| testID | Component | Location |
|--------|-----------|----------|
| `auth-loaded` | `<View>` zero-size | `app/_layout.tsx` — rendered after auth bootstrapping |
| `email-input` | `AnimatedInput` | `app/login.tsx` — email field |
| `password-input` | `AnimatedInput` | `app/login.tsx` — password field |
| `login-button` | `AnimatedButton` | `app/login.tsx` — submit button |
| `workout-card` | `Pressable` | `app/(tabs)/index.tsx` — each workout week card |
| `exercise-row` | `Pressable` | `components/explore/ExerciseRow.tsx` — each exercise list item |
| `start-workout-button` | `Pressable` | `app/workouts/[workoutDayId].tsx` — "Start Workout" button |
| `player-finish` | `Pressable` | `app/workout/active.tsx` — footer "Finish Workout" button |
| `player-confirm-set-{exerciseId}-{setNumber}` | `Pressable` | `components/workout/SetInputRow.tsx` — unique per-set confirm (checkmark) button |
| `player-weight-input-{exerciseId}-{setNumber}` | `TextInput` | `components/workout/SetInputRow.tsx` — unique weight field for each exercise set |
| `player-reps-input-{exerciseId}-{setNumber}` | `TextInput` | `components/workout/SetInputRow.tsx` — unique reps field for each exercise set |
| `player-rest-skip` | `Pressable` | `components/workout/RestTimer.tsx` — "Skip Rest" button |
| `player-next-exercise` | `Pressable` | `app/workout/active.tsx` — "Continue" button on the "Next up" transition (only rendered between exercises) |
| `player-exercise-list-button` | `Pressable` | `app/workout/active.tsx` — header button opening the exercise list sheet |
| `player-sheet-exercise-row` | `Pressable` | `components/workout/ExerciseListSheet.tsx` — each exercise row in the jump-to sheet |
| `player-sheet-close` | `Pressable` | `components/workout/ExerciseListSheet.tsx` — sheet close button |
| `summary-done` | `Pressable` | `app/workout/summary.tsx` — "Done" button, returns to tabs |
| `player-edit-set-{exerciseId}-{setNumber}` | `Pressable` | confirmed set correction action |
| `player-remove-set-{exerciseId}-{setNumber}` | `Pressable` | soft-delete action |
| `player-restore-set-{exerciseId}-{setNumber}` | `Pressable` | Undo action for a removed set |
| `player-add-set-{exerciseId}` | `Pressable` | adds the next non-renumbering set slot |
| `player-workout-note` | `Pressable` | opens the workout-note sheet |
| `history-session-{sessionId}` | `Pressable` | opens a completed session from Profile history |
| `forgot-password-link` | `Pressable` | opens password-reset request from Login |
| `password-reset-request-submit` | `AnimatedButton` | submits the generic reset request |
| `password-reset-confirm-submit` | `AnimatedButton` | submits a new password from a reset link |
| `home-open-coach` | `Pressable` | opens the Coach tab from Home |
| `home-share-workout` | `Pressable` | verifies Home exposes native sharing without automating a share destination |
| `coach-screen` | `SafeAreaView` | confirms the Coach preview is open regardless of its truthful data state |
| `coach-resume-workout` | `Pressable` | resumes an active workout from Coach |
| `coach-open-workout` | `Pressable` | opens the next planned workout from Coach |
| `settings-terms` | `Pressable` | opens Terms of Service |
| `settings-privacy` | `Pressable` | opens Privacy Policy |
| `legal-terms-screen` | `SafeAreaView` | Terms of Service screen |
| `legal-privacy-screen` | `SafeAreaView` | Privacy Policy screen |
| `summary-share` | `Pressable` | opens the native privacy-light summary share sheet |
| `exercise-equipment-names` | `Text` | resolved equipment names or truthful loading/error state |
| `exercise-demo-status` | `View` | reports whether a real demo URL is available |

---

## Architecture Notes

### iOS Keychain Warning

`clearState: true` does NOT clear the iOS Keychain. Auth tokens stored via
`expo-secure-store` persist across app resets. All flows use the **adaptive
auth pattern** — they run the login sub-flow only if the login screen is
showing, and skip it if already authenticated.

### Auth Pre-Flight

Every flow waits for `auth-loaded` (a zero-size marker rendered in
`app/_layout.tsx` once bootstrapping completes) before interacting with the UI.
This prevents race conditions on cold boot.

### Native sharing

Maestro verifies that the completed-summary share action is present. Test the
Home and Summary native share sheets manually on a development build: simulator
share destinations vary by installed apps, and dismissing the sheet should not
show an error.

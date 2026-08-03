# PrimeRep-AI — Maestro E2E Tests

## Setup

### Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
brew install openjdk@17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

### App ID

The `appId` in each flow is currently set to `host.exp.Exponent` (Expo Go).

Update this when switching to a dev/prod build:
- **Dev build (iOS)**: your `ios.bundleIdentifier` from `app.json`
- **Dev build (Android)**: your `android.package` from `app.json`

### Test Account

Each flow uses `testuser@primerep.com` / `StrongPass123`. Create this account once:

```bash
curl -X POST http://localhost:8000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@primerep.com","password":"StrongPass123","preferred_name":"Test","last_name":"User"}'
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
| Exercise Detail | `exercise-detail.yaml` | Workout detail → tap exercise → muscles + equipment |
| Exercise Search | `exercise-search.yaml` | Explore tab search → results → clear |
| Workout Player | `workout-player.yaml` | Start Workout → confirm set → skip rest → jump via exercise sheet → finish → summary |

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
| `player-confirm-set` | `Pressable` | `components/workout/SetInputRow.tsx` — per-set confirm (checkmark) button |
| `player-weight-input` | `TextInput` | `components/workout/SetInputRow.tsx` — weight field for the current exercise's sets |
| `player-reps-input` | `TextInput` | `components/workout/SetInputRow.tsx` — reps field for the current exercise's sets |
| `player-rest-skip` | `Pressable` | `components/workout/RestTimer.tsx` — "Skip Rest" button |
| `player-next-exercise` | `Pressable` | `app/workout/active.tsx` — "Continue" button on the "Next up" transition (only rendered between exercises) |
| `player-exercise-list-button` | `Pressable` | `app/workout/active.tsx` — header button opening the exercise list sheet |
| `player-sheet-exercise-row` | `Pressable` | `components/workout/ExerciseListSheet.tsx` — each exercise row in the jump-to sheet |
| `player-sheet-close` | `Pressable` | `components/workout/ExerciseListSheet.tsx` — sheet close button |
| `summary-done` | `Pressable` | `app/workout/summary.tsx` — "Done" button, returns to tabs |

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

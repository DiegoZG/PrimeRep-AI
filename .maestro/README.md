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

# Standard flows (fixture-specific flows are run separately)
maestro test --exclude-tags seeded .maestro/*.yaml

# Debug mode (step through interactively)
maestro test --debug .maestro/smoke-home.yaml

# Interactive UI builder
maestro studio
```

### Part 9: native offline cold start

Use a native build, not Expo web. Sign in online, start a workout, confirm at
least one set, then disconnect the simulator/device before running
`maestro test .maestro/offline-workout-cold-start.yaml`. The flow force-stops
and relaunches twice, verifies the same workout opens offline, and queues
completion without claiming server confirmation. Reconnect afterward and
verify the workout finishes once on the server with its sets and notes. Repeat
manually on iOS and Android with timeout, backgrounding, account switch, and
expired-auth conditions; the YAML does not toggle the network for you.

### Health connections layout

`maestro test -e APPEARANCE=dark .maestro/health-settings-layout.yaml` inspects the native Health
screen using the existing local test account and usual local backend. Start at
Home or login; it uses adaptive authentication without clearing app storage and
keeps any active workout available to resume. It selects the requested app
appearance; use `-e APPEARANCE=light` for light mode and restore the original
appearance after visual checks.
The flow checks the status, three switch rows, stacked primary source, and
full-width actions, then returns Home. It never changes Health choices, grants
permissions, syncs data, or disconnects a source.

Repeat with light/dark appearance and an accessibility text size on a small
iPhone simulator. Inspect screenshots for neutral switch tracks in both states,
purple ON thumbs, grey OFF thumbs, title/switch alignment, wrapped descriptions,
and unclipped actions. Connected/unselected and unavailable states are also
covered by `npm run test:health-ui`; physical-device switch appearance and
VoiceOver require manual verification.

### Part 8: profile, support, and export

Use the isolated Part 8 database and API described in
[the Part 8 test guide](../docs/part8-profile-support-export.md). Seed it with the
backend's `scripts/seed_profile_e2e.py` (`APP_ENV=test` and a database named
`primerep_part8_ui_*` are required). This creates
`primerep-profile-fixture@example.com` / `StrongPass123`, with 12 completed
workouts and four consecutive active weeks. The flow asserts the fixture email
before changing profile fields; sign out first if a different user is active.

```sh
maestro test -e EXPO_URL=exp://127.0.0.1:8084 .maestro/part8-profile-support-export.yaml
```

This flow checks name save/persistence, unsaved-change confirmation/discard,
achievement navigation, Help/FAQ navigation, and the export explanation. It
restores the fixture preferred name to `Profile`. Shared auth helpers adapt to
logged-in or logged-out state; state waits use `extendedWaitUntil` rather than
fixed sleeps. Native photo pickers, final ZIP share/save completion, mail apps,
platform permission failures, and delayed cross-account requests require the
manual checks in the guide. Valid YAML alone does not establish device coverage.

### Exercise content foundation

`npm run test:exercise-foundation` runs behavioral regressions for 250-result
pagination, delayed account/query responses, independent search offsets,
append/refresh retries, content adapters, single-implement loads, and video
lifecycle/error handling. It uses React's test renderer; native playback still
requires simulator/device checks.

`.maestro/seeded/exercise-foundation.yaml` requires a disposable catalog with
250 `Foundation Fixture 001`–`Foundation Fixture 250` exercises. Entry 201 must
have a synthetic playable-media descriptor. It verifies the fifth search page and inline
playback; do not seed these records into a user's normal database. Override
`LOGIN_EMAIL`, `LOGIN_PASSWORD`, `SEARCH_QUERY`, and `LAST_PAGE_EXERCISE` as needed.
The backend's `scripts/seed_exercise_foundation_e2e.py` provides these fixtures:
it requires `APP_ENV=test` and a database named `primerep_part75_ui_*`, rejects
the normal application database, and never creates trainer/publication reviews.
Run Alembic on that disposable database first, then run the script with
`--video-url http://127.0.0.1:8765/demo.mp4` pointing to a locally served synthetic
clip. The login is `exercise-foundation@example.com` / `StrongPass123` (test only).
Pass `-e EXPO_URL=exp://127.0.0.1:8082` to Maestro for a separate Metro server.
Start isolated builds with `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8001`;
verify the compiled API address before running. SDK 54 development virtual-env
resolution ignored the shell override during this verification, so the successful
web interaction pass used a production export built with those environment values.
Do not change the application's normal `.env` to work around a fixture setup.
For the iOS simulator, run an isolated Expo Go server without development-mode
environment resolution, then open its explicit URL:

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8001 npx expo start --go --localhost --port 8083 --no-dev --minify --clear
xcrun simctl openurl booted exp://127.0.0.1:8083
```

Use `-e EXPO_URL=exp://127.0.0.1:8083` for Maestro with this server. Keep the
fixture API and synthetic video server running while testing.
For browser testing, omit `--dev` when exporting; SDK 54's development
`expo/virtual/env` imports `.env` even with `EXPO_NO_DOTENV=1` and overrides
the fixture API URL. Use a production export:

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8001 npx expo export --platform web --clear --output-dir /private/tmp/primerep-part75-web
```

Serve extensionless Expo routes from the exported HTML files, allow the test
site's origin on the fixture API, and serve the synthetic MP4 with appropriate
video CORS and byte-range headers. A same-origin test proxy can instead use
`EXPO_PUBLIC_API_URL=/api` and forward `/api/*` to the isolated backend. That
relative URL is for browser exports only. Verify login, exercise detail, and
actual playback in the browser; a successful `curl` login alone is insufficient.
Exercise media uses `exercise-watch-demo`, `exercise-video-player`,
`exercise-video-loading`, `exercise-video-error`, and `exercise-video-retry`.
Category and picker pagination use `category-exercise-load-more` and
`program-exercise-load-more`; combined search has independent
`explore-programs-load-more` and `explore-exercises-load-more` controls.

Manually verify native fullscreen, app-background pause, dismissing the workout
information sheet, and both themes on iOS and Android. A custom development
build must be rebuilt after adding `expo-video`; Expo Go must match SDK 54.

### Coach fixture flows

The deterministic Coach suite lives under `.maestro/seeded/` so the standard
suite never silently skips data-dependent assertions. Create its real backend
fixture first:

```bash
cd ../primerep-backend
APP_ENV=local PYTHONPATH=. .venv/bin/python scripts/seed_coach_e2e_fixture.py
```

The fixture provides `coach-fixture@example.com` with password
`StrongPass123` and this exact state:

- A completed-onboarding account with a current unfinished planned workout.
- First-page items ordered as program review, missed workout, recovery,
  progression, personal record, and consistency.
- `coach-fixture-progression`, targeting that planned workout, with detail text
  and `isAiAssisted=true`.
- `coach-fixture-consistency`, which remains dismissible.
- `coach-fixture-older`, returned only on the second cursor page.
- `hasMore=true` plus a valid first-page cursor before pagination.
- Coach preferences enabled at `08:00` in the fixture timezone. OS permission
  must separately be granted to the simulator development build.

The same account also supports the Home dashboard flow. After seeding, run
`maestro test .maestro/seeded/home-dashboard.yaml` to verify its next-workout
action, one unread Coach action and destination, four-week trend, and history
link. Sign out first if the simulator is authenticated as another user; the
adaptive login flow does not replace an existing session. Other Home states
(offline resume, first workout, week complete, and independent API failures)
are covered by focused logic tests or manual scenarios, not this seeded flow.

Run it explicitly with `maestro test .maestro/seeded/coach-feed.yaml`. Override
any fixture value without editing YAML, for example:

```bash
maestro test -e LOGIN_EMAIL=another-fixture@primerep.test \
  -e LOGIN_PASSWORD=StrongPass123 \
  -e PROGRESSION_ID=coach-fixture-progression \
  -e CONSISTENCY_ID=coach-fixture-consistency \
  -e OLDER_ID=coach-fixture-older \
  .maestro/seeded/coach-feed.yaml
```

The error
flow requires `coach-error-fixture@primerep.test`, a failing Coach feed endpoint,
and no active or unfinished workout fallback.

For native notification routing, keep the fixture backend running, install the
development build, authenticate as the fixture account, then deliver:

```bash
xcrun simctl push booted com.diegozegarra.primerep \
  .maestro/fixtures/coach-notification.apns
```

Tap the notification and verify the allowlisted planned-workout destination.
Transient item lookup failures expose `coach-notification-routing-retry` and
must retain the native response until a later successful or terminal lookup.

---

## Test Inventory

| Flow | File | Tests |
|------|------|-------|
| Smoke: Home | `smoke-home.yaml` | Auth resolves, tab bar visible, workout cards load |
| Workout Browse | `workout-browse.yaml` | Tap workout card → workout detail with exercise list |
| Exercise Detail | `exercise-detail.yaml` | Workout detail → tap exercise → muscles, resolved equipment, and truthful demo status |
| Exercise Search | `exercise-search.yaml` | Explore tab search → results → clear |
| Workout Player | `workout-player.yaml` | Start Workout → confirm set → skip rest → jump via exercise sheet → finish → summary |
| Workout Editing | `workout-editing.yaml` | Confirm → edit → remove/undo a set, save a note, then dismiss the keyboard via the backdrop |
| Workout Bulk Save | `workout-bulk-save.yaml` | Save two edited rows without starting rest, catch another unsaved entry at Finish, and save it before completion |
| Workout Logger Layout | `workout-logger-layout.yaml` | Resume the active test workout in light and dark appearance; run after Workout Editing |
| Workout Keyboard Save | `workout-keyboard-save.yaml` | Save the second entered row on the first tap with the keyboard open; run after Workout Editing |
| Workout Correction | `workout-correction.yaml` | Finish with zero sets → add a planned set in history → verify refreshed summary |
| Core Screen Completion | `core-screen-completion.yaml` | Forgot-password request, Coach shortcut, cleaned Explore, and Legal routes |
| Invalid Reset Link | `password-reset-link.yaml` | Deep link submission reaches the generic invalid/expired state |
| Explore Programs | `explore-programs.yaml` | Catalog, builder, immediate/next-week activation, Apply Now, deactivation, substitution review, locked prescriptions/Skip Day, Favorites, and custom exercise lifecycle |
| Coach Feed | `coach-feed.yaml` | Account-fenced next action and settled first-page refresh smoke check |
| Coach Feed (seeded) | `seeded/coach-feed.yaml` | All six item kinds, AI label, read-on-expand, dismiss, pagination, deep link, and reminder-time save |
| Home Dashboard (seeded) | `seeded/home-dashboard.yaml` | Confirmed next workout, unread Coach action/deep link, four-week trend, and history navigation |
| Coach Feed Error | `seeded/coach-feed-error.yaml` | Recoverable full initial error and Retry against the documented failing-feed fixture |
| Push Settings | `push-settings.yaml` | Native OS notification control plus app-owned Coach notification preference |
| Profile, Support, Export (seeded) | `part8-profile-support-export.yaml` | Fixture identity guard, profile save/discard, achievements, Help/FAQ, and export explanation |

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
| `home-next-workout` | `Pressable` | opens the next confirmed unfinished workout from Home |
| `home-coach-action` | `Pressable` | opens the highest-priority unread Coach action |
| `home-four-week-trend` | `View` | shows completed-workout counts for four weeks |
| `home-share-workout` | `Pressable` | verifies Home exposes native sharing without automating a share destination |
| `coach-screen` | `SafeAreaView` | confirms the private Coach briefing is open |
| `coach-resume-workout` | `Pressable` | resumes an active workout from Coach |
| `coach-open-workout` | `Pressable` | opens the next planned workout from Coach |
| `coach-hero-active` / `coach-hero-next` / `coach-hero-caught-up` | hero state | identifies the canonical primary Coach state |
| `coach-period-menu` / `coach-period-close` | `Pressable` | opens or closes the compact Coach history-period sheet |
| `coach-retry` | `Pressable` | retries a recoverable request failure; normal refresh uses the native pull gesture |
| `coach-refreshing` / `coach-feed-ready` | state marker | distinguishes an in-flight refresh from a settled canonical page |
| `coach-view-now` / `coach-view-yesterday` / `coach-view-last7Days` | period filter | switches between actionable guidance and read-only recent history |
| `coach-initial-error` / `coach-inline-error` | error state | distinguishes a full unavailable state from retained-content failure |
| `coach-item-{itemId}` | rail item | identifies one persisted guidance item |
| `coach-item-action-{itemId}` | `Pressable` | marks guidance read through primary action and opens its allowlisted target |
| `coach-item-why-{itemId}` / `coach-item-detail-{itemId}` | expand control/content | opens reasoning in place and marks the item read |
| `coach-item-read-{itemId}` | state marker | confirms the server-owned item is represented as read locally |
| `coach-item-dismiss-{itemId}` | `Pressable` | opens permanent-dismiss confirmation |
| `coach-item-ai-{itemId}` | `Text` | labels wording that was actually AI-assisted |
| `coach-earlier-guidance` | `Pressable` | explicitly loads the next cursor page |
| `coach-notification-routing` | root marker | indicates a validated Coach notification destination is being resolved |
| `coach-notification-routing-retry` | root marker | indicates a transient item lookup is retained for retry |
| `coach-notification-routing-read` | root marker | destination opened while native response awaits successful read persistence |
| `settings-coach-notifications` | `Switch` | explicit app-owned coaching notification opt-in |
| `settings-coach-reminder-time` / `settings-save-coach-time` | time field/action | updates reminder time with the current IANA timezone |
| `settings-coach-saved` | status text | confirms the Coach preference mutation completed |
| `settings-terms` | `Pressable` | opens Terms of Service |
| `settings-privacy` | `Pressable` | opens Privacy Policy |
| `legal-terms-screen` | `SafeAreaView` | Terms of Service screen |
| `legal-privacy-screen` | `SafeAreaView` | Privacy Policy screen |
| `summary-share` | `Pressable` | opens the native privacy-light summary share sheet |
| `exercise-equipment-names` | `Text` | resolved equipment names or truthful loading/error state |
| `exercise-demo-status` | `View` | reports whether a real demo URL is available |
| `program-card-{templateId}` | `Pressable` | opens a system or private program |
| `program-create-button` | `Pressable` | opens the private program builder |
| `browse-programs` | `Pressable` | opens the filterable program catalog |
| `program-filter-{field}-{value}` | `Pressable` | applies a catalog filter |
| `program-builder-day-{position}` | `View` | identifies a draft workout day |
| `program-builder-day-open-{position}` | `Pressable` | opens an ordered draft workout day |
| `program-day-handle-{position}` | gesture target | drags a visible workout day; exposes increment/decrement accessibility actions |
| `program-day-menu-{position}` | `Pressable` | opens the cross-platform fallback action sheet |
| `program-day-move-earlier` / `program-day-move-later` | `Pressable` | moves the selected day one persistent position |
| `program-day-request-remove` | `Pressable` | opens the explicit remove confirmation step |
| `program-day-confirm-remove` | `Pressable` | confirms removal after the separate warning step |
| `program-day-order-{title}-{position}` | persistent state marker | identifies a named workout day's saved draft position |
| `program-day-add-exercise` | `Pressable` | opens the exercise picker |
| `program-exercise-{position}` | `View` | identifies an ordered draft exercise |
| `custom-exercise-save` | `Pressable` | creates or updates a private custom exercise |
| `activation-weekday-{0-6}` | `Pressable` | selects an activation weekday |
| `activation-preview` | `Pressable` | loads canonical schedule and equipment impact |
| `activation-preview-retry` | `Pressable` | retries a failed schedule/equipment preview |
| `program-review-equipment` | `Pressable` | opens activation review for an active program requiring equipment changes |
| `program-review-scheduled-equipment` | `Pressable` | opens activation review for a scheduled program requiring equipment changes |
| `active-program-banner` | `Pressable` | opens the current active program |
| `scheduled-program-banner` | `Pressable` | opens the program scheduled for next week |
| `program-scheduled-badge` | `View` | labels a scheduled program as “Starts next week” |
| `program-cancel-scheduled` | `Pressable` | cancels only the next-week activation |
| `activation-target-week` | `Text` | identifies the effective week used by next-week preview |
| `custom-exercise-loading` | screen state | fences custom-exercise edits until the canonical record is loaded |
| `custom-exercise-load-error` | screen state | retries a failed custom-exercise edit load |
| `activation-confirm` | `Pressable` | activates the reviewed program revision |
| `activation-suggested-{templateExerciseId}-{exerciseId}` | `Pressable` | selects the server-recommended equipment replacement |
| `activation-alternative-{templateExerciseId}-{exerciseId}` | `Pressable` | selects a non-default equipment replacement |
| `program-duration-locked` | `View` | verifies activated-program duration is not editable |
| `skip-day-button` | `Pressable` | skips an activated program workout while preserving its sequence |
| `explore-favorites` | `Pressable` | opens the complete Favorites collection |
| `exercise-favorite-{exerciseId}` | `Pressable` | adds or removes one catalog exercise from Favorites |

---

## Architecture Notes

Program-day handle dragging is intentionally limited to visible nearby rows; it does not auto-scroll the form. Every row's **Options** sheet remains available for repeated one-position moves, including long five-to-seven-day programs.

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

### Coach notification routing

Remote push delivery, Expo ticket/receipt handling, and foreground/background/cold-start
taps require a development build on a registered device. Verify a valid Coach payload
opens only its typed destination, stale or cross-account items fall back to Coach, and a
notification tap wins over automatic active-workout resume. Expo Go cannot fully exercise
the remote notification path.

### Program account isolation

The request-fencing regression requires two pre-seeded accounts and a delayed
API response, so it is kept as a manual deterministic check rather than using
shared credentials in source control: delay Account A's template request, log
out, log into Account B, and verify no Account A program card or builder draft
appears before or after the delayed response completes.

### Manual-only program lifecycle checks

The following cases need controlled time or network behavior and are intentionally
kept out of the shared-account flow:

- **Account switch fencing:** delay a program load or create/update/archive
  response for Account A, leave the screen or sign into Account B, then release
  it. The old response may complete on the server but must not update Account B,
  reopen a screen, or navigate the current stack.
- **Calendar rollover:** open Home before local midnight on Sunday and foreground
  the app after midnight. Home, Coach, activation preview, deactivation, and
  training-preference updates must use the new local Monday without restarting.
- **Mutation back fencing:** begin a program activation, builder save, clone,
  archive/deactivate/cancel, or custom-exercise save/archive, then use the native
  back gesture. Releasing the delayed response must not navigate from the screen
  now visible.

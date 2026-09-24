# Part 8: Profile, support, and personal export

Part 8 adds editable account names and current body statistics, a private profile photo, workout-history-based achievements, Help & Support, and a downloadable personal archive. The supplied Profile designs use PrimeRep's existing purple/cyan colors and light/dark themes; statistics and milestones come from actual account data.

## Environment and rollout

Deploy the backend first, including migration `t5u6v7w8x9y0` and Pillow. The frontend uses authenticated `/v1/users/me/profile`, `/avatar`, `/achievements`, and `/export` endpoints. Custom development/production builds must include the new Expo-compatible native dependencies. A JavaScript update alone does not add native modules to an older custom build.

Configure `EXPO_PUBLIC_SUPPORT_EMAIL` with the real support inbox before a production release. Contact support and Report a problem open a draft in the user's mail application; opening a draft is not confirmation that a message was sent. No external support message is sent automatically.

For isolated testing, use backend database `primerep_part8_ui_20260922` with `APP_ENV=test`, migrate it, then run the backend's `scripts/seed_profile_e2e.py`. That script requires a database whose name begins `primerep_part8_ui_` and refuses normal development/production databases. It preserves an existing fixture account on repeated runs.

The synthetic fixture has 12 completed workouts across the last four full consecutive weeks, body statistics, and valid training preferences:

- Email: `primerep-profile-fixture@example.com`
- Password: `StrongPass123`
- API: `http://127.0.0.1:8002`
- Isolated native Metro: `exp://127.0.0.1:8084`
- Browser verification origin: `http://localhost:8085`

Native Metro can be started from this repository with:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:8002 npx expo start --go --localhost --port 8084 --no-dev --minify --clear
```

The backend CORS configuration must include the browser origin when testing web. An already-open Expo session or browser tab can point at a different backend; confirm the isolated URL before signing in. The fixture account only exists in the isolated database.

## Manual acceptance checks

### Profile editing

1. Open Profile and confirm the fixture email before changing anything. Names, workout count, activity, achievements, and recent training should reflect this account.
2. Open Edit Profile. Change the preferred name and save. Profile and the next editor visit must show the saved value. Sign out and back in to confirm persistence.
3. Change a field and cancel. Keep editing once, then discard. The discarded value must not appear on Profile or the next editor visit.
4. Change weight in LB, switch the editor unit to KG, and confirm the same physical weight. Save, reopen, and verify the selected display units remain truthful.
5. Test an empty preferred name, a name longer than 50 characters, a fractional or out-of-range age, and an invalid weight. No successful save should be claimed. Optional last name, weight, age, and gender can be cleared.
6. Interrupt the network during save. Keep the entered values, show a retryable error, reconnect, and save successfully. Repeated taps while saving must not create competing requests.
7. Confirm email is read-only. Editing profile details must not replace the active workout or regenerate the weekly plan.

### Private photo

1. Select a JPEG or PNG from the photo library, preview it, save, and return to Profile. Verify the chosen photo persists after navigation.
2. Cancel the library picker; the current photo must remain. Replace the photo, then remove it and verify initials return.
3. Test an unavailable library, a malformed/oversized upload, and a failed request. An unsuccessful replacement must not erase the previous saved photo.
4. Sign out while a photo request is delayed, then sign into another account. The previous account's photo and form values must never appear.
5. Inspect a downloaded/exported photo when validating the backend: it must be a metadata-free normalized JPEG, at most 512 pixels on its longest edge and 256 KiB.

Photo-library selection, platform permission prompts, and native image behavior require manual checks on supported platforms; YAML validation alone is not a pass for these scenarios. Camera capture is not included.

### Achievements and history

1. Open the full achievements list. The fixture should have the 1-, 5-, and 10-workout milestones and the 2- and 4-consecutive-active-week milestones, with progress toward the next targets.
2. Open a recent workout and verify the title, completion time, duration, and logged sets agree with Workout History.
3. With an empty account, verify an honest first-workout state and a useful action; there must be no earned badges or fabricated stats.
4. Complete a workout and return to Profile. Refresh should update derived counts and milestones. Editing set weights/reps must not award an extra completed workout.
5. Test Monday/Sunday boundaries and device timezones using controlled backend fixtures. A current week without a workout does not break the previous week's ongoing sequence until that week ends.

### Help and support

1. From Settings, open Help & Support and expand the FAQ topics. Relevant answers must remain readable in light/dark themes and at large text sizes.
2. Open Contact support and Report a problem. Verify the configured address and meaningful subject in the draft. App/platform diagnostics should be included only when opted in; workout notes, body data, credentials, and account identity must not be prefilled.
3. Cancel the draft. The app must not claim a message was sent.
4. Without a mail application, verify the selectable support-address fallback. Without support configuration, verify an honest unavailable state.

### Personal archive

1. Open Export your data from Settings and read the included-data explanation. Request the archive while online.
2. On iOS/Android, save or share the ZIP through the native sheet. On web, download it. Dismissing the sheet is silent.
3. Inspect `account.json`, `workouts.csv`, `sets.csv`, the README, and the normalized photo if one exists. Verify only the current account's records are included.
4. Confirm CSV unit labels match the selected display unit and JSON retains canonical kilogram values for logged sets. Removed sets are marked in JSON and excluded from CSV calculations; unfinished server sessions are represented in JSON.
5. Check that password hashes, access/refresh/reset tokens, push tokens, internal AI prompts, and other users' records are absent.
6. Disconnect during download and retry after reconnection. Sign out during a delayed download and verify it cannot open or share another account's archive. Temporary native files must be cleaned up after completion/cancellation and on logout/startup.

An archive contains service-stored data at generation time. Device-only pending workout changes are outside that snapshot. Import/restore is not supported in this phase.

## Automation and remaining device checks

The dedicated `.maestro/part8-profile-support-export.yaml` uses the isolated fixture, shared adaptive authentication, stable test IDs, and `extendedWaitUntil`. It verifies identity save/discard, achievements, Help navigation/FAQ, and the export explanation without automatically sending support email or accepting a share destination.

```sh
maestro test -e EXPO_URL=exp://127.0.0.1:8084 .maestro/part8-profile-support-export.yaml
```

Use the fixture account or sign out before running. The flow asserts its email before edits, so an unrelated signed-in account fails safely. Native photo selection, real mail applications, final share/save completion, Android, large text, offline/error injection, and cross-account delayed requests remain explicit device/regression checks unless separately recorded as executed.

Record actual command results and device coverage in the PR. Do not infer a simulator pass from valid YAML, a web export, or backend tests.

### Recorded verification — September 22, 2026

- The complete Part 8 Maestro flow passed on the iPhone 16 Plus simulator against the isolated API, including identity save/discard, achievements, Help/FAQ, and export-screen checks.
- Profile was visually checked in light and dark modes. Native photo selection, crop, save, and reopening persisted the selected image; cancelling the picker preserved the unchanged editor with Save disabled.
- Native ZIP sharing completed through Save to Files and returned to the app. The browser ZIP also downloaded successfully. Artifact inspection confirmed five files, 12 workout rows, 36 set rows, and a 512×384 JPEG with no EXIF. Password hashes, access/refresh/push tokens, and protected AI facts were absent.
- Web Profile and Home loaded against the isolated account; Home returned three workouts.
- The Part 8 flow parses as valid two-document YAML, and `git diff --check` passes.
- Missing support configuration and the example `support@your-domain.example` both fail the support release-validation command as intended. A real monitored support inbox remains a release dependency.
- Android, real mail-app behavior, photo permission denial, and large-text verification remain manual release checks. These results do not claim those checks passed.

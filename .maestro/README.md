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

### Home refinement

`maestro --device <isolated-simulator-uuid> test .maestro/home-refinement.yaml`
checks Home in the native development app, with an existing signed-in local
fixture and weekly plan. It preserves a recovered active workout with **Keep
Workout Active**, then checks the carousel overflow/backdrop, workout-detail
navigation, Quick Stats, History, and refresh. It does not save, complete,
abandon, or regenerate workouts; mark Coach guidance read; or change Health
choices. The overflow assertion uses its existing grouped iOS accessibility
label rather than assuming that the menu's child test ID is exposed natively.
An iOS selector tap can occasionally miss after a centered scroll; inspect the
current screenshot/accessibility bounds before diagnosing an app action failure.

Use `-e SCREENSHOT_PREFIX=/private/tmp/home-light` for temporary screenshot
output. Repeat in light and dark appearance. For maximum accessibility text,
first reach Home at normal text size, then increase the isolated simulator's
text size and inspect the primary action, wrapped week header/cards, stacked
stats, Coach text, and two-column trend; restore the prior size afterward.
Do not reset an app or abandon an active workout to enter Home. Physical-device
and VoiceOver checks remain manual; long titles and independent failures are
covered by `node --test scripts/test-home-ui.mjs`.

### Onboarding calculator layout

Manually open the empty one-rep max calculator from the strength-entry screen on
a dedicated guest simulator, then run
`maestro test -e UNIT=lb .maestro/onboarding-calculator-layout.yaml`.
Use `-e UNIT=kg` when the existing onboarding unit is KG. The flow does not launch
or clear the app, sign in, change units, or apply an estimate. It captures the
empty form, keyboard, result, and Apply action, then cancels. Run at normal and
maximum accessibility text size in light/dark mode on a small supported iPhone,
restoring the original appearance/text size afterward. Inspect input visibility,
wrapped labels/actions, and first-tap Calculate with the keyboard open.

Apply/result transfer, invalid input, all three destinations, and LB/KG behavior
also have focused coverage in `node --test scripts/test-calculator-ui.mjs`.
Physical iPhone, VoiceOver entry/return focus, hardware keyboard, and the parent
strength-entry display after Apply still require manual verification.

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

### Training Preferences refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light .maestro/training-preferences-refinement.yaml`
with an already-authenticated native development app and the usual local backend.
Repeat in dark appearance. This flow browses preferences and the equipment
picker, searches only its temporary draft, verifies outside-tap and drag keyboard
dismissal, and cancels with the keyboard open. It reopens the picker to verify
the search reset, then returns Home. It never applies equipment, saves
preferences, changes permissions, signs out, clears data, or modifies a workout.
The existing fixture has zero selected equipment and catalog results for `bench`;
use renderer tests or a separately approved fixture for other data states.

Inspect maximum accessibility text separately after restarting the isolated app:
titles should scroll within the screen width, Cancel/Done should remain reachable,
and picker search, stacked tabs, and result rows should scroll without truncation.
Extreme text may wrap long words mid-word. Wait for scroll animations and inspect
current native bounds before diagnosing a missed selector tap. Picker draft
changes are discarded with Cancel; leave preferences without saving. Restore
the simulator's original appearance/text size and preserve any active workout.
Native Save/Done, successful custom add/remove, physical-iPhone and VoiceOver
checks remain manual. Renderer regressions cover persistence and custom actions.

U08 final verification passed this flow in normal light and dark on a 375-point
iPhone simulator. At maximum accessibility text, the focused search field ends
at y407, immediately above the predictive keyboard beginning at y407; Cancel
and Done remain intact as stacked full-width actions. First-tap Cancel with the
keyboard open also passed. An earlier keyboard-avoidance implementation hid
40 points of the field; native keyboard insets fixed that overlap. A separate
maximum-text tab attempt was driver-limited: centering placed the tab beneath
the fixed header and a tap hit Done, applying an unchanged empty draft locally.
No preference Save or server mutation occurred. Final maximum-text result
navigation and successful custom draft actions remain manual, not claimed passes.

### Settings refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light .maestro/settings-refinement.yaml`
with an already-authenticated native development app and the usual local backend.
Repeat in dark appearance. The flow inspects Settings, opens Terms and Help,
returns without sending messages, and checks the account actions without pressing
them. It never changes Appearance, Units, Coach or AI preferences, requests OS
permissions, signs out, deletes an account, resets app data, or touches Health data.

Inspect the original screenshots and accessibility bounds at normal text size,
then separately inspect maximum accessibility text in both themes. Restart the
app without clearing its data after changing simulator text size so React Native
receives the updated font scale. Preserve any recovered workout with **Keep
Workout Active**, never Discard. Restore normal text size and light appearance
afterward. If the fixture has Coach notifications off or no Premium entitlement,
do not enable them just for screenshots; enabled reminder and Premium controls
are covered by renderer tests and remain manual native acceptance checks.
Physical-iPhone and VoiceOver checks remain manual.

U07 verification passed this read-only flow in normal light and dark on a
375-point iPhone simulator. Initial driver attempts missed the Terms tap and
generic iOS `back` did not navigate; waiting for scroll animations, using the
native action label, and pressing each screen's explicit Back control resolved
those test-driver failures. The final flow checks Terms/Help and returns Home.
Maximum-text inspection confirmed stacked Appearance choices and reachable
Units, wrapped Coach explanations, and the 44-point Settings Back target in
both themes. Extreme text may wrap long words mid-word rather than truncate.
The native Coach switch is 51 by 31 points, with seven-point top/bottom hit slop
inside its 44-point wrapper for an intended 44-point target; parent clipping can
clamp hit slop, so actual edge-hit checks remain manual. Its OFF thumb and
neutral track were inspected; UIKit may apply native track treatments, so
configured-color contrast calculations are not pixel-measured native contrast.
No existing preference or permission was changed. ON/reminder, Premium,
permission refusal/loading/error, save/retry, and account changes are renderer
regressions or manual native checks, not live fixture mutations in this flow.

### Explore refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light .maestro/explore-refinement.yaml`
with an already-authenticated native development app and the local backend.
Repeat after changing only the isolated simulator to dark appearance.
The flow browses recommendations, the catalog, Favorites, Weights, and scoped
exercise search without creating programs, resetting drafts, toggling favorites,
activating plans, or changing an active workout. It assumes the normal catalog
has exercises matching `press` and no program names matching that query.
No app-data reset or account switch is performed. Inspect screenshots at normal
text size, then separately inspect the screen at maximum accessibility text size;
the fixed tab bar and neighboring screen typography are outside this slice.
Physical-device and VoiceOver checks remain manual.

U03 local verification reached the recommendations/catalog, empty Favorites,
All/Programs/Exercises search scopes, and an exercise detail in bounded read-only
runs. The complete flow has not passed end-to-end: native driver scroll/tap and
keyboard behavior interrupted it before category navigation. Weights routing,
builder navigation (which resets its draft), active/scheduled native card states,
and a physical-device/VoiceOver pass remain manual checks. Maximum-text captures
verified Explore's scrollable content and contained section headings in both
themes; extreme text wraps some short labels mid-word.

### Program catalog refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light .maestro/program-catalog-refinement.yaml`
with the authenticated native app already open at normal text size and the usual
local backend running. Repeat in dark appearance with `APPEARANCE=dark`.
The flow changes only local scopes and filters, deselects them afterward, opens
a catalog card's canonical detail, and returns Home. It never presses Build,
activates or edits a program, changes favorites, clears app data, or signs out.
It requires at least one catalog program with a day. Leave any active workout
intact; the flow does not restart the app or touch workout controls.

Inspect the original screenshots for neutral selected chips/checks, readable
semantic equipment warnings, 44-point controls, and both themes. At maximum
accessibility text size, inspect the scrollable header/scopes and wrapping
Goal/Experience/Schedule controls, horizontal Equipment labels, bottom Hide
filters, and results reachability separately. Do not assume a successful driver
command proves visual correctness.

Native pagination cannot be exercised when the usual fixture has fewer than 20
programs. Error/pagination/account-switch states are covered by rendered tests;
physical-iPhone and VoiceOver acceptance remain manual. Do not create fixture
programs or reset drafts just to fill these gaps.

U04 local acceptance passed the read-only flow in normal light and dark on an
isolated 375-point iPhone simulator. Goal, experience, and frequency selection
and deselection, All/PrimeRep/Mine scopes, Hide filters, canonical program detail,
and Home return were exercised. Native scope/Create/Filters accessibility bounds
measured 44 points tall. Maximum-text controls were visually inspected in both
themes, including equipment labels, Hide filters, and results reachability.
The original Upper A 4/4 workout remained intact; the simulator was restored to
normal text, light appearance, and Home. Initial baseline catalog requests failed
but recovered on a text-size app reload without account or backend changes;
the before/after images therefore do not imply a styling fix for that failure.

### Completed-workout correction refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light -e CORRECTION_SESSION_ID=<existing-completed-session-id> .maestro/workout-correction-refinement.yaml`
with an authenticated native app and the usual local backend, then repeat in
dark appearance. Use a generic existing completed fixture with no private note
or Health export opt-in; opening Summary retains its existing reconciliation
callback. Never create or finish a workout to manufacture screenshots.

This read-only flow opens Review or correct workout from Summary, captures the
correction layout and note action, returns to refresh Summary, and uses Done to
return Home with the existing active workout preserved. It never presses Save,
Remove, Restore, or Undo, clears app data, changes authentication, or requests
Health permissions. Inspect normal and maximum accessibility text in both
themes, plus keyboard dismissal and local draft cancellation without saving.
Physical-iPhone, VoiceOver, and live save/remove/restore acceptance remain
manual unless separately recorded. The existing `workout-correction.yaml` is a
different, mutating feature test and must not be used on preserved user data.

`workout-correction-draft-cancel.yaml` additionally requires
`CORRECTION_LOG_ID` for an existing logged set and `CORRECTION_EXERCISE_ID`
for an exercise with an unused prescribed slot. It changes only local numeric
drafts, dismisses the keyboard by tapping the header, checks drafts remain,
then cancels Edit and Add after keyboard dismissal.
It never calls any save/delete/restore action; do not confuse first-tap Cancel
with verification of first-tap Save. Inspect screenshots after animations settle.

U06 local acceptance passed the read-only layout/navigation flow in normal
light and dark (2/2) on the isolated 375-point simulator, plus local Edit/Add
draft-dismiss-and-cancel checks in both themes (2/2). After the final numeric
target adjustment, separate Edit entry/header-dismiss/Cancel checks passed in
both themes; native input interiors measure 46 points and Cancel measures 44.
Maximum-text note layout and local note keyboard dismissal were inspected in
both themes: the 68-point fixed Back header leaves a 579-point scroll viewport,
and the full Save note action remains reachable. No Save action was pressed.

An initial load failure recovered after an ordinary data-preserving app restart;
this is not attributed to the styling change. Transient navigation/keyboard
captures were replaced with settled originals. Maximum-text numeric-editor
driver checks did not complete after bounded attempts and remain a live manual
gap. A hidden Add Cancel tap during a stale-bounds attempt typed into the local
draft; the final safe flow dismisses the keyboard before cancellation instead.
Native first-tap Save, drag dismissal, physical-iPhone, VoiceOver, and live
save/remove/restore behavior remain manual gaps. The simulator was restored to
normal `large` text, light appearance, and Home; a read-only Resume/Keep active
check confirmed the original Upper A still has 4/4 logged sets.

### Program detail refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light .maestro/program-detail-refinement.yaml`
with the authenticated native app already open at normal text size, the usual
local backend running, and the existing Full Body Foundation system program in
the catalog. Repeat in dark appearance with `APPEARANCE=dark` after verifying
the appearance has settled. The fixture must retain its existing active workout.

The flow browses the PrimeRep scope, opens the canonical system program card,
scrolls to the existing Use and Customize actions without tapping them, returns
to the catalog, restores All scope, and returns Home. It never activates,
customizes, edits, archives, stops, or cancels a program; clears app data;
changes authentication; or touches the active workout. Do not run the broader
`explore-programs.yaml` lifecycle flow merely to produce presentation evidence.

Inspect original native screenshots in both themes and at maximum accessibility
text size for contained titles, neutral day numbers and metadata, readable
prescriptions, reachable 44-point Back/actions, and real status indicators.
Native activation/customization/private/scheduled mutations, physical-iPhone,
and VoiceOver acceptance remain manual unless separately recorded. A driver
command alone does not prove that content is visible or correctly colored.

The U09 baseline normal dark top screenshot was excluded because it caught an
appearance transition; genuine dark action and maximum-text captures remain.
No source rollback was performed to manufacture a replacement baseline.

U09 local acceptance passed the read-only flow in normal light and dark on the
isolated 375-point iPhone simulator. At maximum accessibility text, original
images verified the full scrolling title, contained day headers, stacked
exercise name/prescription/block labels, and reachable Use/Customize actions in
both themes. Back measured 44 points tall; maximum-text Use and Customize
measured 166 and 99 points respectively. A first 20-second maximum-text scroll
timed out partway through the long content; a subsequent bounded 60-second
scroll reached both actions at full visibility. This was a test-driver timeout,
not a successful run of the normal-text flow at maximum text.

The existing Upper A 4/4 workout was retained throughout. The simulator was
restored to normal text, light appearance, and Home. Initial catalog/detail
reads recovered after restarting the existing app session without account,
backend, database, or source changes; styling does not claim to fix that failure.

### Program activation refinement

Run `maestro --device <simulator-uuid> test -e APPEARANCE=light .maestro/program-activation-refinement.yaml`
with the authenticated native app open at normal text size, the usual local
backend running, and the existing Full Body Foundation system program. The
fixture has Monday selected and unresolved equipment conflicts; preserve its
existing active workout. Repeat with settled dark appearance and
`APPEARANCE=dark`.

This read-only flow opens schedule setup, checks an incomplete weekday choice
disables review, restores that choice, selects next week locally, and reads the
canonical schedule/equipment preview. It verifies unresolved equipment keeps
Activate disabled, then returns Home. The preview endpoint computes impact
without activating a program. Never tap `activation-confirm`, seed equipment,
or run the mutating `explore-programs.yaml` lifecycle to capture presentation
evidence. No app reset, authentication change, Health operation, or training
mutation is part of this flow.

Use the iPhone 16 Plus for primary screenshots; a 375-point simulator is a
secondary small-screen check. Inspect original light/dark screenshots at normal
and maximum accessibility text for the full program title, wrapped weekday and
start-mode controls, readable schedule impact and warning copy, 44-point
targets, reachable review/disabled activation, and Home return. Appearance or
text-size driver commands alone do not prove the app applied those settings.
Physical-iPhone, VoiceOver, final activation, compatible replacement choices,
current/scheduled program variants, and failed preview remain manual native
checks unless separately recorded; focused rendered tests cover their contracts.

U10 local acceptance passed the full read-only flow in normal light and dark
on the 430-point iPhone 16 Plus. Matched Start now screenshots retain the same
four preserved workouts and zero replacements as the baseline; the flow's
separate next-week preview shows canonical selected dates. Eight unresolved
equipment conflicts were read without changing equipment or activating.

Maximum-text original images verified the untruncated scrolling program name,
all seven weekdays wrapping into contained rows, stacked start-mode controls,
reachable Review, and readable schedule impact/semantic warning copy in both
themes. An initial assertion requiring the entire review group in one viewport
failed; bounded individual impact/warning targets passed instead. A same-route
reopen also retained the existing scroll offset, so the subsequent bounds check
explicitly scrolled to the weekday target. These are driver-scope/navigation
limitations, not passing runs of the normal-text flow at maximum text.

Actual 16 Plus bounds were Back 44×44, normal weekdays 52–53×50, and normal
start modes 188×94 points. At maximum text, weekdays were 189×90–91 (Sunday
386×91), with stacked start modes 386×289 and 386×301. The secondary
375-point normal-text reachability check passed: Back 44×44, weekdays
44–45×51, start modes 160–161×112, and Review 331×54. Its initial unavailable
read recovered after restarting the existing app session without resetting
authentication, modifying the usual database, or changing source.

Both simulators retain their saved active workout. The secondary is back at
Home in normal light appearance; the primary has normal text and its original
dark app preference, ready for reviewing the setup. No final activation,
replacement selection, Health action, or workout completion was performed.

### Program builder validation / pressed-transform repair

Run `maestro --device <simulator-uuid> test -e APPEARANCE=light .maestro/program-builder-validation.yaml`
only after manually verifying an already-authenticated, empty account-owned draft:
blank name/description/aliases, General fitness, Beginner, 35 minutes and zero
days. Repeat in settled Dark appearance. The absence of a visible day alone
does not establish this prerequisite. Do not run on a private or complete draft.

The flow follows the preserving direct builder route, then presses Create twice
to exercise only the existing name validation before any program API request.
It asserts `Give your program a name.` after both presses and captures the
actual result. It does not enter fixtures, reset or restart the app, clear state,
save a valid program, change authentication, touch Health, or finish/discard a
workout. Its authored presence is not a pass unless executed and recorded.

Native iPhone 16 Plus / iOS 18.5 / normal `large` text verification passed this
flow in Light and Dark (2/2). Before the repair, one actual Create press on the
verified empty draft reproduced `Cannot read property 'forEach' of null` in
`processTransform.js` / React Fabric. After the stable transform-array repair,
both presses in both themes showed only the expected name-validation error.
The source hot reload automatically remounted into the existing Upper A 4/4
active logger; this was crash recovery, not an intentional draft-cleanup reset.
Empty metadata and default choices were verified again before the repaired
presses. The original Dark appearance and normal text were restored, and Home
still showed Upper A with 4/4 completed sets. No backend program was created.

Keyboard-open first-tap Create, valid backend Create/Save, busy-state native
interaction, physical-iPhone, VoiceOver, secondary-device and maximum-text
acceptance were not newly exercised by this narrowly scoped hotfix. A bounded
off-screen name-focus attempt did not visibly open the keyboard and is not
counted as a keyboard pass. Existing focused tests cover pressed/released/busy
transform shape independently of these two native validation-only passes.

### Program builder refinement

Run `maestro --device <simulator-uuid> test -e APPEARANCE=light .maestro/program-builder-refinement.yaml`
only with an already-authenticated native app, the usual local backend, and a
manually verified empty account-owned program draft. Repeat in settled dark
appearance. Use iPhone 16 Plus for primary evidence and a 375-point simulator
for the secondary small-screen check. Do not launch/restart the app to clear a
draft, use `clearState`, or press Explore's Build action: that action resets the
existing draft. The direct builder route preserves it.

This flow temporarily enters generic name/description text into an empty local
draft, checks outside-tap keyboard dismissal, adds two disposable local workout
days, inspects Options/Cancel, and removes only those days through the explicit
confirmation. It then clears its own text and returns Home. It never presses
Create/Save, opens the exercise editor, clones or activates a program, touches
Health, changes authentication, or finishes/discards the active workout.

If interrupted, inspect the current draft and restore only the flow's own
changes before leaving; never reset a pre-existing draft. Manual prerequisites
are mandatory: absence of a visible day selector alone does not prove an
off-screen draft is empty. Native screenshot/target/keyboard acceptance will be
recorded separately after execution; this flow's presence is not a test pass.
Physical-iPhone, VoiceOver, hardware keyboard, actual backend saves, existing
private/current/scheduled drafts, drag/accessibility reordering, and storage or
network failures remain manual unless separately verified.

U11 local acceptance passed the complete normal-text local-only flow in Light
and Dark on the 430-point iPhone 16 Plus (2/2). Both runs retained entered text
after outside-title taps, inspected two empty local days and Options/Cancel,
then explicitly removed their own days and cleared their own inputs. A separate
check with the software keyboard visibly open verified both the fixed Program
title and empty header background dismiss it without losing the draft; that
disposable input was cleared afterward. No Create/Save action was pressed.

Bounded individual-target checks passed at maximum accessibility text in both
themes. Full hero title/subtitle wrap in the scrolling content; day edit content
stays above its separate reorder/options row. The options sheet scrolls to an
enabled, fully visible Cancel. These are focused maximum-text layout checks,
not executions of the entire normal-text flow at maximum text.

Actual 16 Plus targets measured Back/Add/reorder/options 44×44 points, normal
input interiors 50 points (description 110), and normal choices 45–46 points
tall. Maximum-text day Edit measured 370×133 and sheet Cancel 390×97; sheet
move actions measured 97 points tall and Remove 165. The secondary 375-point
normal-text day check passed: Edit 227×64, Back/Add/reorder/options 44×44, and
Create 331×56 (not pressed). Its own two disposable local days were removed.

The initial Light appearance assertion used flags the iOS radio control did not
expose to Maestro; CUA verified the checked control and settled theme instead.
A baseline navigation-transition image was replaced with a settled original.
The final primary navigation driver ended before completing its wait; CUA and
read-only hierarchy independently confirmed the expected empty builder. None
of these driver/capture limitations is counted as a passing flow or app fix.

Both simulators retain Upper A with 4/4 logged sets, verified visually on Home.
Actual name/description/alias values and day counts were restored empty before
any ordinary text-trait restart. The primary is left at its useful empty builder
in original Dark appearance and normal `large` text; the secondary is at Home
in Light and `large`. No resetDraft, app-data reset, backend save, Health action,
authentication change, or workout completion/discard was performed.

### Program day editor refinement

Run `maestro --device <simulator-uuid> test -e APPEARANCE=light .maestro/program-day-refinement.yaml`
only at normal text in the already-authenticated native app, with the usual
local backend and a manually verified empty account-owned program draft.
Repeat in settled Dark appearance. Use iPhone 16 Plus for primary evidence and
the 375-point secondary simulator for the small-screen check. Do not reset an
existing draft, clear app data, change authentication, or restart to clear it.

This local-only flow adds its own disposable Day 1 and selects existing public
Deadlift and Lat Pulldown catalog records. It checks empty/populated layout,
Done navigation, Main/Accessory selection, and exercise reorder/remove. Numeric
replacement and keyboard-first-tap acceptance are verified separately through
actual native UI, not claimed from this flow. It explicitly
removes its own day through builder Options and returns Home. It never presses
program Create/Save, clones or activates a program, touches Health, or completes
or discards an active workout. If interrupted, inspect and remove only these
known disposable additions; never reset user content.

Flow authoring and syntax validation do not establish a native pass. Execution,
software-keyboard-first-tap behavior, measured targets, maximum text, both
themes, and restoration are recorded separately after verification. Physical
iPhone, VoiceOver, existing private/current/scheduled drafts, and actual backend
program saves remain manual unless explicitly tested.

U12 baseline originals show both themes with an empty day and one public
Deadlift at its default 3/8–12/90-second prescription. Maximum text in both
themes exposes the former fixed-header clipping of Workout day/Done and the
fixed initials tile. These captures used only a disposable RAM day, explicitly
removed through builder confirmation before any text-trait restart. Normal
`large` text and original Dark app appearance were restored afterward.

The initial maximum-text picker visibility assertion failed because Deadlift
was off-screen; filtering through the existing search and then selecting the
existing catalog record succeeded. This navigation-driver limitation is not
counted as a passing flow or as an app defect fixed in this UI slice. Native
AFTER acceptance is recorded separately below.

The final narrowed normal-text structural flow passed in Light and Dark on the
430-point iPhone 16 Plus (2/2): empty/populated layout, Done/reopen,
Main/Accessory selection, actual two-exercise reorder/removal, explicit own-day
cleanup, and return Home with Resume intact. Numeric replacement was removed
from this flow after bounded driver attempts placed the cursor before the
existing value, producing `03` instead of replacing `3` with `0`. These failed
driver attempts are not counted as passes.

Separate actual native UI checks verified a visibly open software keyboard:
Dark Sets `0` blocked the first Done tap with the correct range error; corrected
Sets `4` and a generic cue survived first-tap Done and reopening. Light Sets `4`
also survived first-tap Done and reopening. Tapping the Dark header or Light body
title dismissed the keyboard without losing the draft. The own generic cue was
cleared and disposable local days explicitly removed afterward.

The first native Done press exposed a real Fabric render error from changing a
pressed transform array to undefined. The U12 repair keeps the scale array in
both states; repeated post-repair Done validation/navigation succeeded without
that render error. Development error recovery remounted the app and cleared the
RAM-only test day; this was not an intentional reset of user data. A later
generic catalog-loading failure resolved after own-day cleanup and an ordinary
authenticated bootstrap refresh. Its HTTP cause was not confirmed, and it is
not presented as a U12 API fix.

Actual normal-text targets measured Back/remove/reorder 44×44 points, Done
73×44, Add 87×44, numeric field interiors 81×50, and block choices 176×44.
Focused maximum-text field/Done visibility checks passed in both themes: four
single-column value fields measured 358×92 points, Done 171×88, and Back 44×44.
The full Workout day title wraps naturally in scrolling content. Field images
are scrolled to show all four values; the Sets label is partly above the visible
body viewport. They do not claim every label and the full hero fit together.
The unchanged picker at maximum text needed keyboard dismissal and direct
selection of its visible public result after the setup driver's visibility wait
failed; this is not a full maximum-text structural-flow pass.

The 375-point secondary focused field/Done check passed with two numeric columns
measuring 144–145×50 points, Done 73×44, and Back 44×44. Its original screenshot
and read-only hierarchy independently confirm the public Deadlift/defaults.
The preceding setup driver reported a selector visibility failure and is not
counted as a passing full small-screen flow. Its known local day was explicitly
removed through builder confirmation.

Both simulators are restored to original normal `large` text. Read-only Home
screenshots visually confirm the same Upper A with 4/4 sets remains active on
both. The primary is Dark at the verified-empty builder; the secondary is
Light/Home. Blank program metadata and default choices were not edited by this
slice's flows; own local days were explicitly removed before ordinary trait or
bootstrap restarts. No program Create/Save, API/storage/permission change,
Health action, account reset/logout, or workout completion/discard occurred.

### Workout Summary refinement

Run `maestro --device <isolated-simulator-uuid> test -e APPEARANCE=light -e SUMMARY_SESSION_ID=<existing-completed-session-id> .maestro/workout-summary-refinement.yaml`
with an already-authenticated native app and the usual local backend. Repeat
with `APPEARANCE=dark` after changing the isolated simulator's appearance.
Select an existing generic fixture through Workout History; do not create or
finish a workout to manufacture screenshots. Public screenshots must not expose
private notes or personal names. Before opening Summary, confirm this fixture
has no Health export opt-in: Summary's existing focus callback can reconcile
previously enabled exports. This flow does not grant Health permissions.

The read-only flow verifies the completed summary, opens Review or correct
workout without editing anything, returns to refresh the canonical totals, and
uses Done to return Home. It does not clear app data, change authentication,
finish/log/correct a session, or share externally. Inspect normal and maximum
accessibility text in both themes for neutral metric/share controls, readable
values, adaptive columns, and reachable 44-point actions. Native sharing,
physical-iPhone, and VoiceOver acceptance remain manual unless separately
recorded; a driver command alone does not prove visual correctness.

U05 local acceptance passed this read-only flow in normal light and dark on an
isolated 375-point iPhone simulator, using the same existing Lower A session
(4m 22s, 3 sets, 3,640 lb, no workout note). Review/back preserved its canonical
totals, and Done returned Home. Maximum-text header/metrics/actions were
visually inspected in both themes: metrics become one column, values remain
uncapped, and actions remain reachable; extreme text can wrap mid-word.
The native iOS share sheet opened and was closed without sharing anything.
No maximum-text before capture was taken. The simulator was restored to normal
text, light appearance, and Home with the original Upper A 4/4 workout intact.
Physical-iPhone and VoiceOver acceptance remain manual.

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
| Onboarding calculator layout | `onboarding-calculator-layout.yaml` | Manual guest entry; empty form, keyboard, decimal estimate, selected Apply, Cancel without writes |
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
| Explore Refinement | `explore-refinement.yaml` | Read-only native recommendations/catalog, favorites, category, scoped search, and exercise-detail navigation |
| Program Catalog Refinement | `program-catalog-refinement.yaml` | Read-only native scopes/filter selection, bottom panel close, canonical card detail, and Home return |
| Program Detail Refinement | `program-detail-refinement.yaml` | Read-only canonical system card, detail metadata, Use/Customize reachability without mutation, and Home return |
| Program Activation Refinement | `program-activation-refinement.yaml` | Read-only weekday/start-mode choices, canonical next-week schedule and unresolved-equipment preview, disabled Activate, and Home return |
| Program Builder Refinement | `program-builder-refinement.yaml` | Verified-empty local draft input/keyboard, two disposable local days, Options/Cancel, explicit cleanup, and Home return without backend save |
| Settings Refinement | `settings-refinement.yaml` | Read-only preferences, Coach switch, Terms/Help navigation, account actions, and Home return |
| Workout Summary Refinement | `workout-summary-refinement.yaml` | Read-only existing completed summary, review editor/back refresh, and Done to Home |
| Workout Correction Refinement | `workout-correction-refinement.yaml` | Read-only existing completed correction layout, note action, Summary refresh, and Home with active workout preserved |
| Workout Correction Draft Cancel | `workout-correction-draft-cancel.yaml` | Local Edit/Add drafts, outside-tap keyboard dismissal, and Cancel without saving |
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
| `program-builder-back` | `Pressable` | leaves the builder without saving or resetting the draft |
| `program-builder-title` | `Text` | full scrolling builder title and outside-input keyboard target |
| `program-builder-header` | `View` | fixed header background supports outside-input keyboard dismissal |
| `program-builder-scroll` | `ScrollView` | scrolls builder metadata, choices, days, and save action |
| `program-day-options-scroll` | `ScrollView` | keeps day options and confirmation actions reachable at large text |
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
| `activation-back` | `Pressable` | leaves setup without activating the program |
| `activation-scroll` | `ScrollView` | scrolls setup, schedule impact, and equipment review |
| `activation-program-name` | `Text` | full program name in the scrolling setup hero |
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

### Exercise detail refinement

Run `maestro --device <simulator-uuid> test -e APPEARANCE=dark .maestro/exercise-detail-refinement.yaml`
on an already-authenticated native development app and the usual local backend.
Repeat in Light appearance. The flow uses the existing public `crunch_machine`
catalog entry: no fixtures, mock server, account reset, or backend writes.

Before running, confirm that its displayed question thread and unsent question
input are empty. Screenshots must not contain private questions or answers.
The flow checks public information, expands/collapses the existing instructions,
checks the empty composer and disabled Send, and returns to the preserved Home
Resume action. It does not type, press Return, or submit an AI question; it also
does not toggle favorites, edit/archive custom exercises, touch Health settings,
or finish/discard an active workout.

Keyboard dismissal, largest iOS text, 375-point layout, VoiceOver, physical-device
playback, favorite failure/retry, and custom-exercise lifecycle need separate
scoped checks. Never submit a question merely to test composer styling. Only
type a disposable unsent draft after verifying an empty input, and erase only
that draft before leaving. Restore the original app appearance and normal text
size after simulator layout checks; verify the active-workout Resume state.

U13 native evidence: the read-only normal-size flow passed in both themes on
iPhone 16 Plus (430 points). Maximum iOS text was inspected in both themes at
the media and empty-composer scroll positions: the header stays controls-only,
and the media caption is readable without overlap; the exercise name is below
the first viewport at that size. Native normal-size Back and Favorite bounds
were 44 × 44 points, and the instruction toggle was 388 × 46 points.

Outside header/body taps dismissed the keyboard and retained a disposable
unsent draft. Dragging dismissed the keyboard, but exact draft retention across
that drag was not independently established because repeated test-tool text
entry changed the test text. Only the disposable draft was cleared; no question
was sent. The SE (375 points) public-info layout was inspected in Light at
normal text, but its full flow did not pass: after opening the accordion, the
paragraph assertion was below the current viewport. Do not report a full SE
flow pass. Both apps were returned Home with their active Upper A / 4-of-4 sets
preserved; original Dark (primary) and Light (SE) app choices, OS Light, and
normal `large` text were restored. No real favorite/custom-exercise mutations,
external-AI requests, Health actions, or account changes were made.

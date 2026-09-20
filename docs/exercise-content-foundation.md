# Part 7.5 — Mobile exercise content integration

Paired branch: `feat/exercise-content-foundation`. Backend merges/deploys first. The complete approved plan is maintained in the paired backend repository at `docs/exercise-content-foundation-plan.md`; the current product roadmap is `docs/roadmap.md` there.

## Mobile deliverables

- Retain current exercise/equipment IDs and existing public response fields. Model string exercise IDs accurately.
- Consume additive published classification, load, content-version, structured instruction, and approved media metadata. Keep legacy text/URL support and private custom instructions.
- Load catalog/category/picker pages in batches of 50 and remove 100-item truncation. Reset pages on search/filter/account changes, fence requests by authenticated identity, and retain complete Favorites responses.
- Use reviewed load metadata in new workout and Coach presentation without changing historical weights. Preserve compact targets and optional detailed formatting.
- Authenticate/fence workout information-sheet detail requests and render the same instructions/media as exercise detail.
- Install SDK-compatible `expo-video` and share a player using `useVideoPlayer`, `VideoView`, and status events. Poster plus explicit play, native controls/fullscreen, uncropped frame, pause on background/navigation/dismissal, truthful loading/error/unavailable states, retry, and poster fallback.
- Keep legacy webpage video links externally openable. Do not promise offline video downloads.

## Contract and release

`GET /v1/exercises` adds pagination/catalog metadata; detail adds published structured content and approved media; Explore search adds separate program/exercise pagination while preserving result arrays; equipment adds aliases/version. Existing snake-case exercise contracts stay snake-case. Backend approval gates keep drafts and private review/rights records out of public responses.

Deploy the compatible backend, then this frontend, then publish actual approved content/media through backend operator tooling. Existing plans/snapshots/history remain unchanged. Frontend readiness does not mean all 200 exercise drafts or media assets are published.

## Verification

Test results beyond 100/200, search/filter/account races, detail/sheet parity, private instructions, light/dark/accessibility, fullscreen/dismissal/playback failures, Favorites/programs/Coach/logging regressions. Run lint/typecheck, interaction audit, Expo web export, Maestro validation and available simulator flows, and diff checks. Manual device checks remain required where native playback/share behavior is not automatable.

Baseline main `bfcc70fabf0919dc4853718c041774e31a4e93c7`: lint passed; typecheck has two existing `TimingConfig.delay` errors at `components/animated-card.tsx:30` and `:34`.

### Independent verification results — 2026-09-20

- Lint, UI-action audit, 11 behavioral regressions, Expo web export (56 routes), and `git diff --check` passed. Typecheck still reports only the two baseline `AnimatedCard` errors.
- Live exported web app against `primerep_part75_ui_20260920`: signed into the synthetic fixture account; loaded all five search pages (250 results); favorited and opened exercise 201; played the locally generated 3-second H.264 clip to completion (`readyState=4`, `currentTime=duration=3`); navigating back removed the video element. The program picker also loaded five pages and added exercise 201 to a temporary program draft.
- Actual web runtime exposed two pre-existing blockers that export alone missed: unguarded native notification-response APIs and native-only SecureStore. Web now skips native push handling and keeps tokens only in memory. Browser reload/closing the tab requires login again; bearer credentials are not persisted to localStorage. Native secure storage is unchanged.
- Reviewed new duration/distance entries are visibly reference-only in the picker; legacy selection remains unchanged.
- iOS Maestro was attempted on iPhone 16 Plus / iOS 18.5 but did not complete: development Metro's virtual environment ignored the isolated API override, followed by a cold-bootstrap timeout after disabling dotenv. No native playback pass is claimed. Android was unavailable. Native fullscreen, background/foreground, workout-sheet dismissal, device playback failures, and light/dark visual passes remain manual checks; lifecycle behavior is covered by mocked regressions, not device proof.
- The normal application database was not migrated. Run backend `alembic upgrade head` for the branch before local application testing. All seeded records and schema round trips used separate disposable databases. The synthetic clip is a technical fixture, not an approved exercise demonstration.

## Outstanding external inputs

Actual trainer review and Diego's publication approval are required per revision. Filmed assets require participants/permissions; paid AI generation needs a selected provider, access, and spending limit. Production video delivery needs storage credentials and a media domain. The pilot briefs cover push-up, dumbbell shoulder press, and squat; 25-video scaling is a later decision. No reviews or media production may be represented as complete without the real artifacts.

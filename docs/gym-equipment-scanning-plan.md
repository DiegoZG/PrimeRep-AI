# Gym equipment scanning — frontend implementation brief

Proposed plan, November 7, 2026. Frontend base: `3db343f`, containing merged subscription PR #112. The authoritative cross-repository plan is backend `docs/part12-gym-equipment-scanning-plan.md` on paired branch `feat/gym-equipment-scanning` in `DiegoZG/PrimeRep-AI-Backend`.

This is planning only. The existing subscription illustration remains Coming soon. No provider is selected and no recognition or approved-media coverage is implied.

## Flow and scope

Explore → Scan equipment → Take photo / Choose photo → Review / Retake → Identify → Possible machines → Confirm machine → Exercise choices → Published instructions / approved demonstration when available.

- Confirm every machine result in the first release, and never choose an exercise automatically. One machine can support several exercises.
- Keep None of these, retake and manual equipment search available. Permission denial, unsupported images, uncertainty, quota or provider errors have a manual path. Offline, show reconnect/retry; cached names may be browsing hints, clearly unverified, while current matching, compatibility and publication checks require connection.
- Explain additional equipment/attachments before calling an exercise compatible. Scanning a cable station does not prove a bench or handle is present.
- Use PrimeRep IDs unchanged. Provider IDs, recognition output, database structure and media publishing stay behind the backend contract.
- Initial photo capture targets iOS and Android with separate physical-device gates. Web initially offers manual search. Live camera overlays and image Q&A are separate scope.

## Discovery and allowed patterns

| Need | Existing source |
| --- | --- |
| Response normalization and IDs | `services/exerciseService.ts:34–114,201–216`; `interfaces/exercises/types.ts:1–158` |
| Photo review/resize/cleanup | `app/profile/edit.tsx:23–94`; `services/privateFiles.ts:12–44`; `services/privateFiles.web.ts:5–16` |
| Binary transport | `services/binaryClient.ts:4–29`; dedicated native upload example in `services/privateFiles.ts:26–44` |
| Account generation fencing | `services/accountScope.ts:1–15`; logout cleanup in `utils/authContext.tsx:374–409` |
| Equipment rows / pagination | `components/equipment/equipment-card.tsx:27–155`; `components/exercises/CatalogPageFooter.tsx:5` |
| Playback behavior | `components/exercises/ExerciseMedia.tsx:21–85` |
| Route protection | `app/_layout.tsx:374–424` |
| Current flags / subscription state | `services/featureFlagService.ts:3–56`; `services/subscriptionService.ts:4–31` |
| Truthful teaser | `components/subscriptions/SubscriptionBenefitIllustrations.tsx:18–44,75–108`; `docs/subscriptions.md:43–51` |

ImagePicker `~17.0.11`, ImageManipulator `~14.0.8` and Expo Video `~3.0.16` already exist. `app.json:37` disables camera permission. No new camera dependency is required for system still capture. Verify installed types against [Expo SDK 54 ImagePicker source](https://github.com/expo/expo/blob/sdk-54/packages/expo-image-picker/src/ImagePicker.ts), [result/options types](https://github.com/expo/expo/blob/sdk-54/packages/expo-image-picker/src/ImagePicker.types.ts), and [permission plugin](https://github.com/expo/expo/blob/sdk-54/packages/expo-image-picker/plugin/src/withImagePicker.ts); public v54 docs redirect to a newer SDK.

Allowed capture APIs: `getCameraPermissionsAsync`, `requestCameraPermissionsAsync`, `launchCameraAsync`, `launchImageLibraryAsync`; inspect `canceled/assets`, use image-only capture, and keep microphone permission disabled. Android activity recovery needs its own acceptance check. Updating permission strings/configuration requires a native build.

Existing equipment search is local name/ID/category filtering and can use stale/static fallback data. The scanner's new bounded name/alias search and compatibility decisions are server-authoritative. Existing ExerciseMedia uses `media?.url ?? demoVideoUrl`, and exercise normalization falls back to legacy instructions; those fallbacks do not prove approval.

## Implementation slices

1. **Contract and manual discovery.** Read the paired plan's API schemas and copy the normalization/row/footer patterns above. Add scan interfaces/service fixtures plus bounded equipment search, machine confirmation, paged exercise choices and strict published guidance. New proposed endpoints are `GET /v1/equipment/search`, `GET /v1/equipment/{id}/exercise-options` and `GET /v1/exercises/{id}/guidance`. Keep existing `/v1/equipment` and exercise responses compatible. Verify names/aliases, multiple choices, additional requirements, missing instructions/video, retired/private/draft exclusion and stable IDs. Do not use an existing single-equipment filter as full compatibility.

2. **Capture and request lifecycle.** Copy the profile's permission/result/normalization/cleanup pattern, preserving full equipment shape instead of the avatar's square crop. Use preview followed by an explicit upload to proposed `POST /v1/equipment-scans`. Add a dedicated service with caller cancellation, account/request generation and one idempotency key per photo submission. The backend enforces size/decode/quota/timeout bounds; no automatic billable retries. A `409 scan_result_stale` response offers current manual search or explicit retry with a new key, never an automatic recognition call. Verify cancel/retake/account switch/back/foreground races and cleanup. No photos in route parameters, analytics or persistent app state.

3. **Candidate and guidance UI.** Show at most five equipment candidates with qualitative confidence; keep numeric confidence hidden while the backend returns an uncalibrated null score. Require a user choice even for high-confidence candidates. Show multiple exercises for the chosen machine and any missing requirements. Reuse player behavior with approved-only inputs in a scan-safe view; never expose provider descriptions/videos or let legacy fallback imply approval. Verify accessibility, unavailable states and manual fallback.

4. **Availability and release.** Consume the new default-off `equipment_scanning_enabled` flag as additive data; the backend rechecks access before recognition. The scan entitlement/quota policy is a product decision, independent of purchases/enforcement/onboarding flags and training admission. Keep Coming soon until a real adapter, supported catalog coverage, privacy terms and device checks are ready. Test iOS/Android camera and library flows on physical devices; verify browser manual discovery, light/dark, large text, small screens and screen readers. Release behind selected-user rollout; disabling recognition keeps manual discovery available.

Each slice uses the paired plan's verification checklist and anti-pattern guards. Planned tests include response normalization, account/retake races, confirmation, compatibility and publication fixtures plus affected existing regression checks. Provider selection/budget, initial machine cohort, access policy and release thresholds are pending; do not present fixture recognition as the delivered feature.

## Identity and integration boundaries

Renames/content changes preserve IDs. Retired/replaced entries keep historical references and snapshots; materially different movement/tracking/load semantics use distinct IDs. A provider switch requires reviewed mappings and coverage tests, with unchanged mobile contracts and workout/history identity.

Scanning does not automatically alter workout plans, active sessions, saved equipment or logged weights. Any future Add/Swap workout action must use existing explicit actions and subscription admission. Workout reliability monitoring belongs to the original session; preserve its branch/worktrees and scope.

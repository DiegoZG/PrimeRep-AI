# Part 10 health release gates

The Settings → Health connections screen is read-only in this branch. It fetches PrimeRep's saved connection state but does not request OS permissions, read device health data, upload summaries, export workouts, or mutate a health connection. A server connection record does not prove OS authorization. The screen deliberately cannot classify OS access as granted, denied, or revoked.

Do not enable health collection or its controls until all of these are complete:

1. A native iOS build proves HealthKit availability, permission request, aggregate steps, asleep intervals, and one duration-only workout write on a physical iPhone. Exercise refusal, revocation, no-data, retry, and duplicate-write paths. Expo Go is not sufficient.
2. Android Health Connect receives its own native read/write test before Android release. This test is deferred by the current iOS-first decision, not considered passed.
3. The revised privacy policy and matching frontend/backend policy versions are approved and published. Verify Apple capability/disclosures and Google Play Health Apps declaration before each platform release.
4. The backend's `HEALTH_COLLECTION_ENABLED` gate remains false until the applicable platform's approved release. Schedule the 90-day purge job before retention is advertised as operational in production.

The current UI describes the intended 30-day initial import, rolling 90-day retention, and the fact that exported workouts remain in the OS health store after disconnect. It is not an active consent flow.

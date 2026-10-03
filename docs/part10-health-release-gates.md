# Part 10 health release gates

The [Health privacy wording](part10-health-privacy-approved-draft.md) was approved by Diego on 2026-10-02, is in the app, and is [live at a public URL](https://diegozg.github.io/primerep-legal/). A custom domain is not necessary. Frontend/backend policy versions match and existing users can renew acceptance from Health settings, but publication and in-app acceptance are **not** permission to enable Health collection before the remaining release gates pass.

Settings → Health connections now contains separate iOS choices for reading steps/sleep, saving newly completed PrimeRep workouts, and using imported summaries in Coach. The app has foreground read sync, a durable workout-export retry path, and disconnect controls. These paths remain **server-gated** while backend `HEALTH_COLLECTION_ENABLED=false`; their presence in the UI does not mean health collection or workout export is released. A PrimeRep connection record is consent state, not proof of OS authorization. Apple Health does not reveal whether read access was granted or revoked, so an empty query must not be labelled as denial.

The development-only diagnostic passed a limited physical-iPhone check on October 1, 2026: HealthKit was available, a step aggregate was returned, and one explicitly confirmed one-minute test workout appeared in Apple Health. No asleep data was recorded in that query. This does not verify the production consent, sync, export, revocation, or retry lifecycle.

Do not enable production health collection until all of these are complete:

1. Complete signed, physical-iPhone end-to-end testing of the actual Settings connection: permission grant/refusal/revocation, no-data behavior, 30-day import, Coach opt-in, canonical completed-workout export after online and offline finishes, retries, restart, disconnect, and duplicate prevention. Expo Go cannot run the native bridge.
2. Privacy wording and public publication are complete. Verify renewed acceptance for existing users in the release build, and verify Apple Health capability and platform disclosures before iOS release.
3. Schedule the backend's 90-day purge command in production. Request-time pruning alone does not remove expired data for inactive accounts.
4. Keep `HEALTH_COLLECTION_ENABLED=false` until the applicable platform's approvals and tests are complete. Android Health Connect implementation/native testing and its Google Play Health Apps declaration are deferred under the iOS-first decision, not considered passed.

The UI describes the intended 30-day initial import, rolling 90-day retention, and that already exported workouts remain in Apple Health after disconnect. Account deletion removes PrimeRep's health connection and summaries but cannot promise deletion of records already written to Apple Health. Part 9 production infrastructure and restore gates remain separate.

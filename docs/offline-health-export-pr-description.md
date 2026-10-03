# Fix offline workout export eligibility

## Summary

An offline-finished workout could reach the server and appear in PrimeRep history but never reach Apple Health. The workout screen's autosave did not include `finishedAt`; after a finish was queued, a later autosave could replace the durable finish timestamp with `NULL`. Health export candidates require that timestamp, so the workout was silently excluded.

## Changes

- Stop screen autosave while a finish is pending, syncing, or failed.
- Protect a queued completion from timestamp-less stale writes in native SQLite and web storage. **Continue logging** remains the explicit path that cancels a queued finish and clears its timestamp.
- Add native and web regressions for stale autosave after an offline finish, including restart, terminal cleanup, Health export eligibility, and intentional continuation.

## Verification

- `node --test scripts/test-offline-health-export.mjs scripts/test-offline-finish.mjs scripts/test-health-export.mjs` — 21 passed.
- Health UI, read-sync, and Apple Health adapter suites — 23 passed.
- `npm run lint`, `npm run typecheck`, `npm run test:audit-ui-actions`, web export, and `git diff --check` passed.

## Known limitation and rollout

The already-affected workout has no locally saved finish timestamp. This fix cannot accurately reconstruct its end time or automatically add it to Apple Health; server confirmation happened later than the actual finish. After installing this build, repeat the offline-finish flow with a new workout on the physical iPhone and verify one Apple Health entry after reconnection and app foreground. No backend change or migration is required. Part 10's public privacy URL, platform disclosures, and other release gates remain separate.

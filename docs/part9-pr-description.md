# Part 9 frontend — offline cold-start workout recovery

## What changed

- Cache the verified signed-in identity securely on native devices so a saved active workout can reopen after a cold start without network access. Other app routes remain behind an offline screen until authentication reconnects.
- Permit local set confirmation and queued workout completion when the access token is unavailable; retain an honest pending/failed finish state after relaunch and retry authentication automatically when connectivity returns.
- Fence cached identity and token writes across account switches, and clear the cached identity on logout.
- Require HTTPS for non-development API builds and separate EAS preview/production environments.
- Add a native Maestro interruption flow and test instructions for offline force-kill, relaunch, finish, and reconnect.

## Verification

- Profile/auth unit tests: **18 passed**; exercise-foundation tests: **11 passed**.
- Expo lint, UI-action audit, web export with a preview HTTPS API URL, and Maestro YAML syntax passed.
- Typecheck still reports only the two pre-existing `AnimatedCard` `TimingConfig.delay` errors; no new type errors.
- `git diff --check` passed.

## Rollout and open gates

Merge the backend Part 9 PR first. Configure distinct preview and production `EXPO_PUBLIC_API_URL` values in EAS; these values are public and must be HTTPS. The offline cold-start flow still needs manual execution on signed iOS and Android builds with an already-saved active workout. No production host, signed build, monitoring account, or store submission is claimed by this PR.

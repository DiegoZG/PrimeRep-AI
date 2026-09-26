# Part 9 frontend — offline cold-start workout recovery

## What changed

- Cache the verified signed-in identity securely on native devices so a saved active workout can reopen after a cold start without network access. Other app routes remain behind an offline screen until authentication reconnects.
- Permit local set confirmation and queued workout completion when the access token is unavailable; retain an honest pending/failed finish state after relaunch and retry authentication automatically when connectivity returns.
- Fence cached identity and token writes across account switches, and clear the cached identity on logout.
- Require HTTPS for non-development API builds and separate EAS preview/production environments.
- Add a native Maestro interruption flow and test instructions for offline force-kill, relaunch, finish, and reconnect.
- Let users add missed prescribed sets to completed workouts, including exercises with no logged sets. Add-set retries retain their operation ID; deleted slots offer Restore, and conflicts reload the canonical session.
- Show correction weights in the selected LB/KG unit while preserving kilograms in storage. Refresh the summary after corrections, and fence workout detail/summary responses to the current account and session.
- Explain unlogged sets before finishing. While a finish is saved locally but unconfirmed, offer **Continue logging** and keep new sets ahead of completion in the durable replay queue on native and web. If completion has already reached the server, open the completed-workout editor instead.
- Add a focused Maestro flow for the zero-set correction path and refreshed summary.
- Reconcile queued set slots against the saved session once during offline-finish replay. Matching sets are acknowledged without repeated duplicate POSTs; a different saved value remains a visible conflict instead of being overwritten.

## Verification

- Profile/auth unit tests: **18 passed**; exercise-foundation tests: **11 passed**.
- Offline completion/replay tests: **8 passed**, including duplicate-slot burst and conflicting-value regressions.
- Expo lint, UI-action audit, web export with a preview HTTPS API URL, and Maestro YAML syntax passed.
- Typecheck still reports only the two pre-existing `AnimatedCard` `TimingConfig.delay` errors; no new type errors.
- `git diff --check` passed.
- The CoreGraphics `NaN` warning was investigated with `CG_NUMERICS_SHOW_BACKTRACE=1`. Historical warnings were confirmed, but none recurred during that run, so no app-owned source or fix is claimed.

## Rollout and open gates

Merge the backend Part 9 PR first. Configure distinct preview and production `EXPO_PUBLIC_API_URL` values in EAS; these values are public and must be HTTPS. The offline cold-start flow still needs manual execution on signed iOS and Android builds with an already-saved active workout. The new Maestro correction flow has been syntax-checked but has not yet run on a simulator. No production host, signed build, monitoring account, or store submission is claimed by this PR.

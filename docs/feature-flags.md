# Subscription feature flags

Open **Settings → Administration → Feature flags** while signed in to a backend-authorized administrator account. Regular accounts do not see the link and the server rejects direct admin access. Access is granted by immutable user UUID in backend deployment configuration, never by an email checked in the app.

Deploy the backend endpoints, migrations and admin UUID bootstrap first. Preview and production keep separate snapshots; always check the environment label before saving. Both flags default to false. This foundation does not connect billing, introduce a paywall, or change existing training access; Part 11 will consume the flags.

Edit purchases, enforcement and the UTC launch timestamp, then **Save changes** to apply them together. Both switches can be disabled in a single save. Enforcement requires purchases enabled and a launch date no later than now. The first enforcement activation permanently locks the launch date, including after enforcement is turned off. The transition deadline is launch plus 30 days.

Use an explicit UTC timestamp ending in `Z` (for example `2026-11-01T12:00:00Z`), or leave it blank before launch is locked. The deadline shown while editing is a preview; backend validation determines whether a save is accepted.

**Refresh** loads the current version and recent audit history. Unsaved edits require confirmation before refresh replaces them. A version conflict preserves edits and requires refresh before another save. Failed requests never display a success message. Loading and saving disable concurrent actions; account changes immediately discard the prior account’s page and pending results. Settings checks admin eligibility on focus; there is no global flag polling yet.

Audit history shows the newest 20 changes, their version, timestamp, administrator UUID and before/after values. The backend is authoritative for permissions, validation, dates, version checks and audit history. Never expose the admin UUID allowlist or deployment secrets in public app configuration.


## Individual user rollout

The global switches are master controls. Turning one off disables that flag for everyone, including users with an Allow override. When on, choose **Everyone** (the existing default) or **Selected users**, then Save together with the master switches and launch date. Selected users starts off for users with no override. Groups and percentage rollout are not included.

Open **Manage user access** to search by exact email address or account UUID. Search identifiers are sent in a POST body, never in a URL. Verify the displayed name, email and UUID before changing access. The configured users list shows only accounts with overrides, 20 at a time; selecting one fetches a fresh user snapshot before editing.

Each flag has **Use default**, **Allow**, and **Deny**. Use default follows the audience; Allow opts a user in; Deny opts them out. An off master always wins, and enforcement also requires purchases to be effectively on for that user. The page shows the current resolved flags and a clearly labeled preview while editing. These controls never grant subscriptions or entitlements.

Save applies both overrides atomically against the environment version. **Reset to default** stages both overrides for removal; Save is still required. With both defaults saved, that account disappears from the configured list. Global and user changes share one version counter: a conflict retains the draft and requires Refresh. Lookup, selecting another user, refresh, and leaving a dirty global form require an inline discard confirmation that works on native and web.

The global dashboard and user dashboard refresh on focus only when their forms are clean. Explicit Refresh also loads current configuration, selected-user resolution and configured users. Account changes reset all private state immediately and invalidate outstanding callbacks and responses. A permission denial clears identity, list and controls; an unknown/deleted user clears the selected account. No global flag polling or billing integration has been added.

Recent changes identify Global or User scope, the target account UUID (or Removed account), and the separate administrator UUID. Launch date locking and the single launch-plus-30-day transition clock apply globally; user overrides do not create individual trial dates.

# Subscription feature flags

Open **Settings → Administration → Feature flags** while signed in to a backend-authorized administrator account. Regular accounts do not see the link and the server rejects direct admin access. Access is granted by immutable user UUID in backend deployment configuration, never by an email checked in the app.

Deploy the backend endpoints, migrations and admin UUID bootstrap first. Preview and production keep separate snapshots; always check the environment label before saving. Both flags default to false. This foundation does not connect billing, introduce a paywall, or change existing training access; Part 11 will consume the flags.

Edit purchases, enforcement and the UTC launch timestamp, then **Save changes** to apply them together. Both switches can be disabled in a single save. Enforcement requires purchases enabled and a launch date no later than now. The first enforcement activation permanently locks the launch date, including after enforcement is turned off. The transition deadline is launch plus 30 days.

Use an explicit UTC timestamp ending in `Z` (for example `2026-11-01T12:00:00Z`), or leave it blank before launch is locked. The deadline shown while editing is a preview; backend validation determines whether a save is accepted.

**Refresh** loads the current version and recent audit history. Unsaved edits require confirmation before refresh replaces them. A version conflict preserves edits and requires refresh before another save. Failed requests never display a success message. Loading and saving disable concurrent actions; account changes immediately discard the prior account’s page and pending results. Settings checks admin eligibility on focus; there is no global flag polling yet.

Audit history shows the newest 20 changes, their version, timestamp, administrator UUID and before/after values. The backend is authoritative for permissions, validation, dates, version checks and audit history. Never expose the admin UUID allowlist or deployment secrets in public app configuration.

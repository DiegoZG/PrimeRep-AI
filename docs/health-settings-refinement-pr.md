# Refine Health connections styling and alignment

## Summary

Match Health connections to the calmer workout logger with neutral surfaces,
compact controls, and restrained purple, without changing consent or Health
data behavior.

## Changes

- Native switches use the same neutral grey track in both states, including the
  iOS background. Only the ON thumb is purple; the OFF thumb remains grey.
- Align each title and switch in a header row with descriptions below. Titles,
  the page header, and action labels wrap on small screens and large text.
  Native switches have vertical hit slop for a 45-point touch target while
  retaining the system switch's compact visual size.
  At accessibility font scales of 2× or greater, the fully scaled page title
  scrolls with the content while the Back control stays in a compact header.
- Stack Primary source, the accessible checked Apple Health selection, and its
  Coach explanation instead of placing competing text side by side.
- Neutral icon-and-text actions with pressed/disabled treatments and 44-point
  minimum targets. Disconnect uses a restrained theme-aware destructive color.
- Compact neutral heart/status card includes account connection details, last
  sync, and Apple's read-access limitations without a duplicate status heading.
- Ordinary retry and developer controls remain neutral. Privacy acceptance
  retains its explicit primary action; all disclosures and release gates remain.

## Verification

- 26/26 Health UI tests pass, including ten added light/dark tests for native
  switch colors, row alignment, source states, disabled controls, action styling,
  retained disclosures, privacy acceptance, status retry, and uncapped
  accessibility-size title placement.
- 48/48 focused Health regressions pass across UI, permission/adapter behavior,
  read sync, account-scoped deletion, export retries, and offline completion.
- TypeScript, lint, UI-action audit, and diff checks pass.
- Read-only Maestro layout flow added for native screenshots and navigation;
  it does not change Health choices or read/write Health data.
- Production web export passes with 62 static routes using an HTTPS placeholder
  API URL; the production guard correctly rejects local HTTP configuration.
- Native iPhone 16 Plus layout flow passes in both themes at normal text size
  and in dark mode at accessibility-extra-large. The largest text setting uses
  a scrollable page title and compact fixed Back control to preserve access.
- iPhone SE (3rd generation, 375-point screen) light-mode layout inspection
  passes with the title, choices, stacked source, and actions visible without
  horizontal clipping. Its Settings navigation selector needed one observed
  coordinate tap; the remaining read-only assertions and return Home pass.
- Diego confirmed physical iPhone ON switches retain grey tracks with purple
  thumbs and the source layout is aligned, without changing Health choices.
- Simulator checks preserve active workouts and do not grant Health permissions
  or toggle read/export/Coach choices. Manual VoiceOver reading order and
  tapping the outer switch hit-slop edges remain unverified.

## Dependencies and rollout

- Frontend-only; no API, database migration, Health permission, synchronization,
  export, retention, consent, or storage changes.
- Existing action handlers and test IDs are preserved. Shared theme tokens and
  switches outside Health connections are unchanged.
- No native rebuild is required for these JavaScript styling changes.
- Part 10 production-release gates remain unchanged.

# U35b · Shared profile layout

At text scales above 1.3, full page titles scroll with the existing content instead of occupying the fixed toolbar. Back and the original optional action stay above the body. Normal headers are unchanged. Only decorative avatar initials stop scaling inside their fixed circles; readable names, titles, fields and body copy stay uncapped.

The gallery contains 36 unmodified canonical PNGs: 18 original and 18 candidate across ten matched configurations, covering all four ProfilePage consumers and both ProfileAvatar consumers. Exact per-image hashes, bytes, dimensions and methods belong in [provenance.json](provenance.json).

## Edit Profile · SE Light MAX

The original fixed title consumes a large part of the viewport. The candidate moves the complete title into the existing keyboard-aware form scroller; it may wrap, but is not truncated or capped. Save remains controlled by the unchanged form state. No Save or Cancel activation is claimed.

| Original | Candidate |
| --- | --- |
| ![Edit Profile MAX top before](original-edit-se-light-max-top.png) | ![Edit Profile MAX top after](candidate-edit-se-light-max-top.png) |
| ![Edit Profile MAX footer before](original-edit-se-light-max-footer.png) | ![Edit Profile MAX footer after](candidate-edit-se-light-max-footer.png) |

## Profile avatar · SE Dark MAX

These are settled, avatar-focused body positions, not initial-top images. The 76-point circle is exposed inside the viewport. The original initials clip; the candidate uses a fixed decorative glyph while preserving the existing full-name accessibility label and the separately scaling readable identity. This is not VoiceOver certification.

| Original | Candidate |
| --- | --- |
| ![Profile MAX avatar before](original-profile-se-dark-max-avatar-focused.png) | ![Profile MAX avatar after](candidate-profile-se-dark-max-avatar-focused.png) |

## Normal layout · Edit Profile SE Light

The title remains in the original header at normal size. The existing avatar size, field values, photo actions and disabled Save presentation are retained.

| Original | Candidate |
| --- | --- |
| ![Edit Profile normal top before](original-edit-se-light-normal-top.png) | ![Edit Profile normal top after](candidate-edit-se-light-normal-top.png) |

<details>
<summary>Remaining fourteen pairs across all consumers</summary>

| Configuration / position | Original | Candidate |
| --- | --- | --- |
| profile · Plus dark normal · top | ![Before](original-profile-plus-dark-normal-top.png) | ![After](candidate-profile-plus-dark-normal-top.png) |
| achievements · Plus dark normal · top | ![Before](original-achievements-plus-dark-normal-top.png) | ![After](candidate-achievements-plus-dark-normal-top.png) |
| achievements · Plus dark normal · footer | ![Before](original-achievements-plus-dark-normal-footer.png) | ![After](candidate-achievements-plus-dark-normal-footer.png) |
| export · Plus dark normal · top | ![Before](original-export-plus-dark-normal-top.png) | ![After](candidate-export-plus-dark-normal-top.png) |
| export · Plus dark normal · footer | ![Before](original-export-plus-dark-normal-footer.png) | ![After](candidate-export-plus-dark-normal-footer.png) |
| help · Plus light normal · top | ![Before](original-help-plus-light-normal-top.png) | ![After](candidate-help-plus-light-normal-top.png) |
| help · Plus light normal · footer | ![Before](original-help-plus-light-normal-footer.png) | ![After](candidate-help-plus-light-normal-footer.png) |
| edit · SE light normal · footer | ![Before](original-edit-se-light-normal-footer.png) | ![After](candidate-edit-se-light-normal-footer.png) |
| help · SE light max · top | ![Before](original-help-se-light-max-top.png) | ![After](candidate-help-se-light-max-top.png) |
| help · SE light max · footer | ![Before](original-help-se-light-max-footer.png) | ![After](candidate-help-se-light-max-footer.png) |
| achievements · SE dark max · top | ![Before](original-achievements-se-dark-max-top.png) | ![After](candidate-achievements-se-dark-max-top.png) |
| achievements · SE dark max · footer | ![Before](original-achievements-se-dark-max-footer.png) | ![After](candidate-achievements-se-dark-max-footer.png) |
| export · SE dark max · top | ![Before](original-export-se-dark-max-top.png) | ![After](candidate-export-se-dark-max-top.png) |
| export · SE dark max · footer | ![Before](original-export-se-dark-max-footer.png) | ![After](candidate-export-se-dark-max-footer.png) |

</details>

## Capture method and limits

Candidate captures ran on base HEAD `41a7c748` with the six frozen working changes. Source milestone `1e9727bf` was created after capture; exact file hashes establish equivalence. The later commit was not served during capture, and no separate post-commit restart or capture is implied.

There are five cold font/theme groups per side, not ten independent cold starts or a full device/theme/font cross-product. The original side has nine fresh configurations/16 fresh images plus one reused SE Dark MAX Export configuration/two images from the accepted U38 evidence. Plus Dark Export is fresh. The candidate side has ten fresh configurations/18 images. Both final manifests and all canonical images were accepted.

Pair by host, device class, theme, OS text size and top/footer/avatar-focused target—not identical gestures, scroll percentages or pixel positions. Ordinary footer targets are reached without activation. MAX uses verified body-contained gestures; the reused Export MAX endpoint is pixel-only, without a new 100% accessibility or numeric bounds claim. An unchanged Help normal page may have identical top/footer pixels; both canonical manifest records remain included.

The full MAX title may wrap and scroll. Long final Help/Achievements paragraphs can remain partly above the viewport. The candidate Export privacy paragraph fits its sampled MAX body, but the unpressed archive action is partly above the viewport. The change does not promise every title, field, paragraph and action fits together. No native Save, Cancel, Back destination, photo, FAQ, support, refresh, archive/share, error/busy/success or permission action was executed. No keyboard, VoiceOver, Android, physical-device or CI acceptance is claimed. Existing fictional identity visible in raw pixels is not edited; public metadata omits account identity and private setup details.

## Local verification and preservation

Author verification: 49 shared-layout cases plus 147 existing contracts (196 focused), one 1,679-test standard run, typecheck, UI-action audit/self-tests, syntax and scoped lint pass. Independent review passed the same 196 focused and one 1,679-test standard run, with no findings; all three review gates were accepted. The focused tests are part of the standard total, not added to it. Project lint has zero errors and two inherited hook warnings. Fresh-process web export has 62 HTML pages and 18 exact author source modules (independent review verifies an expanded set of 21).

Renderer coverage includes context isolation, 1.3/1.31 boundaries, same-mounted state across dimension changes, original Save/Back busy semantics, existing Retry/FAQ behavior, and both avatar sizes with URI/error/reset/initials/label contracts. It proves mocked structure and state, not native focus or screen-reader speech.

Only shared profile-ui, one Edit Profile heading adapter and four test files change. Four other route files, controllers, provider/services, AchievementRow, existing style helpers, theme and copy remain exact. The three historical harness updates are limited to explicit dimension mocks, reviewed shared-source pins and original import reconstruction. No dependency, configuration, migration or rollout flag change.

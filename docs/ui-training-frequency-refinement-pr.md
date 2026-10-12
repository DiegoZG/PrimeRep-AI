# U22 Training Frequency UI refinement

Training Frequency’s recommendation badges and selected cards previously competed with NEXT. The badges now use neutral surfaces, the selected choice has a clear border and animated check, and enabled Continue owns the purple emphasis. Continue scrolls with the seven choices and can grow with accessibility text.

Only this screen changes in production. The exact seven IDs, ordered titles, question, helper and two “Recommended for you” tags remain unchanged. Every choice exposes a radio checked state and its exact title/tag label; the decorative check is hidden from accessibility. Existing system fonts, readable helper colors, natural text metrics, automatic scroll insets, and a minimum 56-point actual Continue target support enlarged text without caps or truncation.

The complete 5,226-byte controller remains byte-identical to base `6ffc2364bf5203127b71829f4c527583b6063460`. Local restored selection, context writes and draft persistence, replacement/repeated taps, disabled/direct-handler gating, `/onboarding/workout-split` navigation, entrance timing, checkmark animation and button press feedback retain their existing behavior. Shared components, constants, theme, hooks, providers, dependencies, API and native configuration do not change.

## Verification

The unchanged current-screen harness passed 18 baseline cases before production edits. The candidate passes those same cases plus eight distinct presentation checks: 26/26. It renders the real screen, OnboardingProvider, AnimatedButton, AnimatedCheckmark, ThemedView, transition/theme hooks and theme constants; native rendering/animation, routing, auth context and storage boundaries are mocked. Both themes cover all seven fresh/restored choices, exact writes and unrelated-field preservation, draft/provider/route remounts, local selection versus external context updates, route gating and exact motion configurations. Presentation checks cover exclusive accessible selection, readable text/tag/selection contrast, enabled-only purple and naturally growing scroll content. Structural font-scale tests do not measure native glyphs.

Independent verification passes 26/26 screen checks and all 658 named core tests; the standard Node run reports 659 passing results because it also counts the audit self-test script runner once. Lint, TypeScript, interaction audit/self-test and diff checks pass. The controller hash remains `db7e6031d0e9b782266da3eeb6ff4b24597dff5b76a9a1f85a699b1d194bebd6`; 210 shared files are byte-identical to the branch base.

A fresh cache-cleared independent web export with `EXPO_NO_DOTENV=1` and temporary verification URL `https://u22-independent-api.invalid` produces 62 actual HTML files. Its emitted `entry-4d5e34b71692bc0ec787012b54b98daf.js` contains the new selectors and that URL. All checks use frozen screen SHA256 `ac8df328231c1051b38707cab323ab528961dacbfa150dbafb425493f2e83bbe`. Independent logs remain at `/private/tmp/u22-independent-verification.ZKfK8U`; implementation logs remain at `/private/tmp/u22-engineering.r1aTO1`.

## Native evidence and limits

Five native configurations pass on the final frozen source: normal Light/Dark, cold maximum-text Light/Dark, and compact Light read-only. The two normal themes collectively exercise all seven choices with checked/unchecked replacement, actual Continue→Workout Split and public-return persistence. Both maximum-text runs reach whole question/helper, all option titles and both tags through overlapping real scroll captures, activate a radio choice, and show the entire grown Continue above the safe area. They cover layout/selection, without claiming a maximum-text forward-route run. The compact empty guest reaches disabled Continue and returns to empty Signup without edits.

Three genuine original BEFORE captures use screen SHA256 `b55c50f121303e36e9278116e83773306a86466f66569a470157463a5d949b30`; seven AFTER captures use the final hash above. All ten repository PNGs match their original simulator captures byte for byte. The visible Dark comparison uses the same 3-days selection before and after. Original Light/Dark initial screenshots are genuinely unselected. Normal rows measure 64–65 points, tagged rows 94–95, and Continue 56; separate bottom captures show safe-area clearance.

There were no failed native test invocations. A supplementary Dark maximum-text capture verifies the whole helper after a bounded content drag; a matcher alone did not establish header clearance. Maximum-text tags wrap naturally, including the word Recommended, with all glyphs present. The shared cyan Skip remains oversized/clipped at maximum text outside this screen’s scope. The dedicated fictional fixture finishes Light/large with 3-days selected and keyboard closed, without claiming restoration to the original blank choice; the compact guest stays at empty Signup. No physical iPhone, Android, VoiceOver audio/traversal, OS Reduce Motion execution or native frame timing is claimed. Harness motion checks verify preserved structure and configurations.

## Independence and rollout

This independent branch starts at `6ffc2364bf5203127b71829f4c527583b6063460`; it is not stacked on U23 or U25 and has no shared presentation prerequisite. Scoped guards freeze only this screen’s controller, explicitly allowed import changes and Training Frequency content, without freezing unrelated planned screens or asserting a global Git diff. No API change, migration, dependency update or special rollout is required. The shared header is unchanged. The user’s untracked design directory and local roadmap stay excluded. Reverting this screen restores its prior presentation. No automatic merge is authorized.

## Screenshot review

Before, normal Dark with 3 days per week selected:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-before-dark-selected.png" width="320" alt="Original Training Frequency in Dark with 3 days per week selected and emphasized recommendation badges" />

After, normal Dark with the same 3 days per week selected; the full Continue frame is shown below:

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-dark-selected.png" width="320" alt="Refined Training Frequency in Dark with 3 days per week selected through a neutral border and check" />

<details>
<summary>Original Light and Dark unselected states</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-before-light-initial.png" width="320" alt="Original Training Frequency in Light with all choices unchecked and NEXT disabled" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-before-dark-initial.png" width="320" alt="Original Training Frequency in Dark with all choices unchecked and NEXT disabled" />

</details>

<details>
<summary>Final Light selection and complete Light/Dark Continue frames</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-light-selected.png" width="320" alt="Final Training Frequency in Light with 3 days per week selected and the whole question and helper visible" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-light-bottom.png" width="320" alt="Final Light bottom frame with the complete enabled Continue and safe-area clearance" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-dark-bottom.png" width="320" alt="Final Dark bottom frame with the complete enabled Continue and safe-area clearance" />

</details>

<details>
<summary>Final cold maximum-text Light/Dark and compact Light empty state</summary>

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-light-max-bottom.png" width="320" alt="Final Light maximum-text bottom frame with the entire grown Continue; 3 days remains selected above this viewport" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-dark-max-bottom.png" width="320" alt="Final Dark maximum-text bottom frame with Every day checked and the entire grown Continue" />

<img src="https://raw.githubusercontent.com/DiegoZG/PrimeRep-AI/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/u22-after-compact-light-disabled.png" width="320" alt="Final compact Light empty guest scrolled to the disabled neutral Continue" />

</details>

[Screenshot provenance and configuration coverage](https://github.com/DiegoZG/PrimeRep-AI/blob/f5cdb71299b55960c415559a72f50d637d36360f/docs/pr-screenshots/u22/README.md)

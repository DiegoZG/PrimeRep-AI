# Exercise selection during an active workout

The player exposes **Choose exercise** below the current exercise heading and
keeps the header's list shortcut. Both open the existing list, where unfinished
and completed exercises remain selectable. Selection preserves exercise order,
targets, per-exercise entries and logged progress; it does not log or skip sets.

An existing rest countdown keeps its original deadline and exercise. When the
user views another exercise, the timer names its origin. Manual navigation
suppresses that timer's automatic transition, including after restarting the
app. The optional suppression flag uses existing local rest-context JSON;
there is no server API change or database migration.

## Independent iOS verification

Verification used a new fictional Morgan account in the isolated task database,
a separate iPhone 16e / iOS 18.5 simulator at 390 × 844 points, Metro 8092 and the
real local API on 8040. Existing user fixtures, devices and workout choices were
not modified. The final reviewed bundle was cold-loaded before the final
rest-persistence and maximum-text checks.

| Scenario | Observed result |
| --- | --- |
| Visible navigation | Choose exercise was visible before any set was logged, directly above notes and set inputs. |
| Zero progress | The list showed the current exercise and saved-set counts. Selecting the second exercise and returning to the first worked with zero completed sets. |
| No accidental logging | Server session fields, workout plan and local draft rows remained unchanged by zero-progress navigation; the server's computed elapsed-duration summary was excluded from exact comparison. |
| Unlogged draft | Entering 77 × 9 on the first exercise, selecting the second and cold-restarting restored the second selection. Returning to the first restored the unlogged values; the server still had zero set logs. |
| Partial progress | Logging first-exercise sets, switching away and returning retained confirmed rows. The native fixture finished with exactly three first-exercise set logs and no sets logged for the other exercises. |
| Rest origin | While the second exercise was selected, its screen displayed the first exercise's running rest timer and name. |
| Durable timer state | Read-only snapshots before and after a final-bundle cold restart retained the exact rest deadline, original exercise context, suppression flag and selected exercise ID. |
| Dark / maximum text | A cold launch at accessibility-extra-extra-extra-large allowed scrolling to Choose exercise, opening the list, scrolling to the last exercise, selecting it, reopening the list and reaching Close. Close remained reachable while the list body scrolled. |
| Final restoration | Returning the isolated simulator to normal light appearance and restarting retained the newly selected third exercise and its blank inputs. |

The native rest case used an unfinished exercise. Completed-exercise navigation,
last-set expiry/transition races, offline replay, account/session guards and
accessibility-focus restoration are covered by the mounted tests; they are not
claimed as additional native passes here. Full VoiceOver gestures, TalkBack,
Android runtime and physical devices were not exercised.

The exact flow files and read-only state comparisons remain private:

```sh
selection_qa_dir=/private/tmp/primerep-exercise-selection-qa
python3 "$selection_qa_dir/run-maestro.py" native "$selection_qa_dir/zero-navigation.yaml"
python3 "$selection_qa_dir/run-maestro.py" native "$selection_qa_dir/draft-switch.yaml"
python3 "$selection_qa_dir/run-maestro.py" native "$selection_qa_dir/draft-restart.yaml"
python3 "$selection_qa_dir/run-maestro.py" native "$selection_qa_dir/partial-rest-switch.yaml"
python3 "$selection_qa_dir/run-maestro.py" native "$selection_qa_dir/rest-restart.yaml"
python3 "$selection_qa_dir/run-maestro.py" native "$selection_qa_dir/dark-max.yaml"
```

## Safe simulator captures

These captures contain only synthetic workout data:

- [Choose exercise before logging](screenshots/workout-exercise-selection/ios-choose-exercise.png)
- [Rest from another exercise](screenshots/workout-exercise-selection/ios-rest-other-exercise.png)
- [Last exercise and reachable Close at maximum text](screenshots/workout-exercise-selection/ios-list-dark-max.png)

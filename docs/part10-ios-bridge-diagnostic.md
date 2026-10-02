# Part 10 iOS bridge diagnostic

This is a development-only, explicit-action HealthKit check on a physical iPhone. The shipping **Health connections** screen stays read-only and the backend `HEALTH_COLLECTION_ENABLED` switch stays off. The diagnostic does not connect a PrimeRep health source, upload daily summaries, export real PrimeRep sessions, or send health values to analytics or AI. It must not be used as a substitute for the privacy and release approvals in `part10-health-release-gates.md`.

## Physical-device result

On October 1, 2026, the signed development build on a connected iPhone reported HealthKit available, completed a steps query, requested workout-write access, and saved a one-minute test workout that the tester confirmed in Apple Health. No asleep data was recorded for the queried dates; that is an empty sample result, not evidence of denied read access. This verifies the iOS bridge's basic read/write path, not production connection, sync, export reconciliation, revocation, or privacy approval.

## Build and open

1. Use a native iOS development build signed for the connected iPhone. Expo Go cannot run the bridge. A free Xcode Personal Team can provision the local HealthKit test build, but the generated project's Push Notifications capability prevents Personal Team signing. Remove Push Notifications only from the ignored local `ios/` project for this test; do not change the tracked Expo configuration or use that build to test push. On first install, trust the developer certificate on the iPhone under **Settings → General → VPN & Device Management**.
2. Start Metro for that build with `EXPO_PUBLIC_HEALTH_BRIDGE_TEST=1`, using a LAN-reachable host for the iPhone. If the local `.env` points at `127.0.0.1`, set `EXPO_NO_DOTENV=1` and `EXPO_PUBLIC_API_URL=http://<Mac-LAN-IP>:8000` before `npx expo start --dev-client --lan --port 8081 --clear`; localhost on the iPhone is not the Mac. The route and link require both the bridge flag and `__DEV__`; release builds redirect the route to Health connections. If the development launcher retains an old server, enter the current Metro LAN URL manually.
3. In PrimeRep, open **Profile → Settings → Health connections → Open developer bridge test**. The link should be absent without the flag.
4. Keep the backend health-collection flag off. A backend connection is not needed for this local test.

## Run one operation at a time

1. Tap **Check HealthKit availability**. Expect `available` on a supported physical iPhone.
2. Tap **Request steps and sleep read access** and make your choice in the iOS permission sheet. Apple does not disclose read authorization to the app; a completed request or empty result is not proof that access was granted or denied.
3. Tap **Read yesterday and today**. The screen displays only those two daily aggregates in local memory. Compare them with Apple Health yourself; do not share screenshots containing personal values.
4. Tap **Request workout write access**. Continue only if the screen reports that write access is granted.
5. Tap **Add 1-minute test workout** and review the confirmation. Confirm once to write a real, duration-only **Other** workout to Apple Health. PrimeRep attaches the title **PrimeRep HealthKit test (1 minute)** as metadata, but the Health app may not display that custom title. It contains no calories, notes, sets, or steps. The button disables after success for the current screen session.

To check refusal and revocation, change PrimeRep’s access in Apple Health settings, reopen the diagnostic, and use the same explicit read or write checks. A failed or empty read must not be presented as proof of refusal. Test restart and retry paths separately; do not assume a successful permission sheet means an aggregate was returned.

## Cleanup

In Apple Health, find the 1-minute **Other** workout under workout data by its **PrimeRep source and time**, then delete it if you do not want it in your personal record. A repeat write on the same local date uses the same stable sync ID and may update or replay the existing record rather than add a duplicate; inspect the resulting entries instead of assuming either outcome. A write on another date uses a different ID. Deleting or disconnecting PrimeRep does not automatically remove workouts already saved to Apple Health.

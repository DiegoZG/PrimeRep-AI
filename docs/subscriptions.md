# RevenueCat subscriptions

The app consumes the existing `subscriptions_purchases_enabled` and `subscriptions_enforcement_enabled` server flags. Neither is enabled by this change. The backend verifies `premium` and authorizes new training; SDK CustomerInfo never grants server access. Existing admitted sessions keep their local-first set logging and offline recovery.

## Configuration

`react-native-purchases` is pinned at **10.16.0** for Expo 54 / React Native 0.81.5. RevenueCat's [Expo migration guidance](https://www.revenuecat.com/docs/sdk-guides/react-native-cocoapods-to-spm-migration#expo-apps) says to retain CocoaPods and SDK 10.x: SDK 11.0.0 requires `PurchasesHybridCommon 20.1.0`, unavailable on CocoaPods until after November 7, 2026. The [10.16.0 release](https://github.com/RevenueCat/react-native-purchases/releases/tag/10.16.0) uses the published `PurchasesHybridCommon 19.17.0`. The adapter uses the installed SDK declarations for `configure`, `logIn`/`logOut`, `getAppUserID`, `getCustomerInfo`, `getOfferings`, `purchasePackage`, trial eligibility, listeners, restore, and management. See the official [Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo) and [identity guide](https://www.revenuecat.com/docs/customers/identifying-customers).

- Configure the Apple app with bundle ID `com.diegozegarra.primerep` in the matching RevenueCat project.
- Attach the intended monthly and annual Apple subscription products to entitlement `premium` and the current offering's monthly and annual packages. No product IDs/prices are hardcoded in the app.
- Set `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` to the project's **public Apple SDK key** (`appl_...`). Provider API secrets and webhook secrets belong only on the server.
- `EXPO_PUBLIC_BILLING_ENV=production` is the default. Only explicit `preview` permits a `test_...` Test Store key. Keep preview and production project/key/endpoint mappings aligned with the backend environment.
- The PrimeRepAI preview project (`proja9fc1792`) has a Test Store app (`app116807ef76`), a `premium` entitlement, and the current `default` offering. Its monthly and annual packages use `primerep_premium_monthly_test` and `primerep_premium_annual_test`, each with a one-week test trial. Test prices are $9.99/month and $79.99/year; they are not launch prices. The ignored local `.env.local` selects preview and contains the public Test Store SDK key.
- Configure restore behavior to **Transfer to new App User ID**. Restore runs only after a user taps Restore Purchases. It may transfer billing access; it does not move workout data.
- Build a new native development client after installing the SDK. Expo Go, Android, web, absent keys, and production Test Store keys do not initialize checkout. Those runtimes can still read backend access and reach saved workout data.

The adapter serializes binding and native operations and checks both account UUID and identity epoch, including A→B→A changes. Checkout is disabled until that identity is ready. An in-progress Apple payment cannot be cancelled by toggling a rollout flag; a confirmed payment is still reconciled.

## Behavior and recovery

Both flags off retain baseline training. Purchases on with enforcement off expose optional plans to the selected audience. Enforcement on requires verified backend access or a valid transition grant for new training. Unknown access is a connection/verification state and does not open a paywall. A known flags-off snapshot can preserve an offline local draft start; server replay always checks the current rules before creating its session.

New enforced sessions are admitted through the existing session creation API using a durable client session ID. The admitted server ID is saved before routing to the logger. Overview and direct active routes share this guard. Already admitted local sessions bypass billing bootstrap so they can resume offline after access expires. Unadmitted queues denied by the server stay on the device with explicit recovery controls.

Successful/pending Apple purchases are recorded per account before backend reconciliation. When verification is delayed, the UI keeps a recovery notice and disables duplicate checkout. While that notice is visible in the foreground, six bounded GET checks use backoff to observe worker reconciliation; background/unmount cancels them. The app does not poll POST reconcile. Foreground refresh, SDK updates, and manual Check subscription provide further recovery. Account deletion tombstones and clears pending recovery without deleting another account's data.

If a fresh reconciliation confirms no active subscription or an expired/refunded subscription, the user may explicitly clear the notice after a confirmation that recommends Restore first and explains that billing is not cancelled. Clearing re-verifies again; an unknown/unavailable result never removes payment recovery.

Settings shows subscription maintenance for known subscribers and payment recovery even when new offers are off. Restore and management remain independent of purchase exposure. Full annual prices and trial terms come from the selected store product; unknown/ineligible trial status never promises a free trial. Subscription denial during week bootstrap settles to an empty/stored preview instead of logging out or blocking account tools.

## Subscription screen

The membership summary keeps the verified status, matching plan, and trial/renewal/end date visible. Billing expiry is shown even when enforcement is off and the access snapshot supplies no access-expiry date. Current subscribers get one primary Manage subscription action; eligible offers use selectable monthly/annual rows with full localized prices and store-provided trial terms.

Restore purchases and Check subscription are quieter action rows with explanations and individual loading states. The result stays visible through ordinary refreshes. Restore explicitly confirms success after backend verification; a later loss of Premium access clears stale success feedback. Pending purchases and verification errors retain visible recovery actions and prevent duplicate checkout. Content scrolls, text wraps, and controls retain at least 44-point touch areas in both themes. Celebration animations remain deferred.

## Future UX TODO

- Add a brief celebration when a free trial or paid subscription becomes verified and active. Show it once for the new activation, never for pending or failed purchases; respect Reduced Motion and keep the subscription screen usable while it plays.

## Verification and release gate

Run `npm run test:subscriptions`, `node scripts/test-workout-arrangement-player.mjs`, `node scripts/test-workout-detail-ui.mjs`, `node scripts/test-settings-ui.mjs`, `node scripts/test-program-detail-ui.mjs`, and the storage/offline-finish/feature-flag suites. Run `npm run typecheck` and `npm run lint` for integration changes.

Native compile verification passed on November 1, 2026 for commit `c5a0514`: Expo prebuild, CocoaPods installation, and an unsigned generic iOS Simulator Debug build using Xcode 16.4 and iOS 18.5 SDK, for both arm64 and x86_64. CocoaPods resolved `RNPurchases 10.16.0`, `PurchasesHybridCommon 19.17.0`, and `RevenueCat 5.99.0`. The build used an isolated clean checkout and `CODE_SIGNING_ALLOWED=NO`; no app was installed and no purchase or provider configuration was exercised.

On November 3, 2026, the installed iPhone 16 Pro Max preview verified a simulated annual Test Store purchase, backend entitlement, active restore, and expired monthly-trial reconciliation. No real charge or StoreKit transaction occurred. The screen redesign passes 314 affected mounted/integration tests, typecheck, and lint with the two existing hook warnings. Native visual inspection of the redesign is pending because the Mac was locked during verification; check both themes, large accessibility text, plan selection, and restore feedback before merging. Preview testing also exposed an overnight expired-token recovery issue and a trial-eligibility discrepancy that still need investigation before release.

RevenueCat Test Store products are configured for preview; Apple products are **not yet configured**. Fixture and mounted tests exercise orchestration and recovery; they do not establish real StoreKit purchase success. Before sales/enforcement: configure Apple products, credentials, eligible introductory offers and final prices; run purchase/pending approval/renewal/expiry/restore/management on a physical sandbox iPhone; verify backend webhook delivery and environment isolation; approve updated subscription/privacy disclosures and launch time. Keep production enforcement off during private purchase testing because the first activation freezes the global launch/transition clock.

Follow the backend billing runbook for durable worker deployment, verified entitlement state, webhook authentication, and incident rollback. Disable enforcement first, or both flags atomically, while retaining subscriber verification and management.

# Phase 11.7 — Development-only Android calendar interface

**Production HOLD. No Firebase deployment, public booking activation, production APK modifications, or protected booking changes.**

## Implementation
- `demo/phase117/DemoOwnerCalendarActivity.kt` is an isolated Android Activity source outside `app/src`, with a real demo calendar screen, appointment rows in Europe/London time, confirmed/cancelled status, a connect control, owner token input and a 5-second reconnect/polling cycle. It does **not** compile into or install as an APK in this phase.
- `functions/phase117CalendarDevServer.js` exposes only a local `POST /demo/calendar` endpoint, bound to `127.0.0.1:8765` when launched explicitly. It uses the Phase 11.6 verified owner authoriser and read-only calendar snapshot, with synthetic `demo_*` businesses.
- Android emulator host mapping `10.0.2.2:8765` reaches the development machine's loopback server. **Physical Android phones cannot use 10.0.2.2** and are not connected by this phase.
- Polling replaces the full calendar snapshot keyed by booking ID, so reconnect and idempotent replay cannot append duplicate rows. Booking statuses are read from Firestore on each poll. Phase 11.6 already separately tests Firestore real-time listeners.
- `functions/phase117AndroidCalendar.integration.test.js` contains twelve emulator integration and static safety tests: initial feed, website booking, replay, cancellation status, reconnect, customer/invalid token denial, production business denial, invalid date, injection, isolated Android source and protected legacy bookings.

## Running locally
1. Start Firebase Firestore and Auth emulators for demo project `demo-boustio-legacy-init` (never production credentials).
2. Set `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `GCLOUD_PROJECT` and `GOOGLE_CLOUD_PROJECT` to their demo values; do not set `GOOGLE_APPLICATION_CREDENTIALS`.
3. Run `node functions/phase117CalendarDevServer.js` and use a synthetic business whose `ownerUid` matches an email-verified Auth emulator account.
4. For a **future dedicated debug APK only**, add the demo Activity to a debug-only source set, declare the Activity and INTERNET permission in a debug-only manifest, and allow cleartext traffic only in that isolated debug variant. Never put the emulator host, tokens or cleartext settings in release builds.

## Limits
This phase implements the source for an Android demo interface and tests its backend contract; it **does not build, install or instrument-test an Android APK**, or verify phone UI behaviour. Polling is near-real-time, not a push stream; it refreshes every five seconds while connected. Future work must use a dedicated debug build and emulator UI tests before claiming actual Android-device integration.

**Expected test total:** 274 previously verified + 12 new = 286, pending GitHub Actions verification.

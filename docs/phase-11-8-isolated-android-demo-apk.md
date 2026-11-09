# Phase 11.8 — Separate Android development APK

**Status: code committed, CI verification pending. Production HOLD.**

A completely separate Gradle Android project exists under `demo/phase118/`, with application ID `uk.co.boustio.calendar.demo`. The existing `app/`, production signing workflow, production website and Firebase deployment are unchanged.

## Demonstration Android screen
- Shows demo booking service, staff, confirmed/cancelled status and Europe/London time.
- Refreshes owner calendar every five seconds while connected. It **polls**, not a Firestore real-time Android listener; updates are near-real-time.
- Replaces rows by booking ID, suppresses stale requests after screen exit or business switch and shows reconnection state on network failures.
- Allows manual entry of a verified Firebase **Auth emulator** owner ID token. Never use real owner credentials or production tokens.

## Safe connection
- The app requests only `http://127.0.0.1:8765/api/owner-calendar`, with cleartext HTTP permitted only to loopback. A development computer or Android-emulator host must run `functions/phase118DemoAndroidCalendarServer.js` with Firestore/Auth emulators and the demo project `demo-boustio-legacy-init`.
- With a connected Android device or emulator, use `adb reverse tcp:8765 tcp:8765` so the phone's loopback maps to the host's loopback service. This requires ADB and a reachable host; **the APK cannot reach GitHub Actions' temporary emulators over the internet**.
- The server checks the owner token against Firebase Auth emulator and `phase113DemoBusinesses/{id}.ownerUid`. It binds to `127.0.0.1` only, never a public network.
- The separate APK has no `google-services.json`, no production Firebase SDK and no release signing secrets.

## Build and test
- Workflow `.github/workflows/phase118-demo-android.yml` builds only `:demoapp:assembleDebug` from `demo/phase118` and uploads `Boustio-Phase118-Calendar-DEMO-ONLY`. This does not overwrite the production APK.
- The emulator safety workflow runs three additional static/API tests. **No physical-device instrumentation test or successful APK compilation has been verified yet.**
- No booking writer is added. The calendar API is read-only; synthetic bookings are created using Phase 11.5's separate demo engine.

## Remaining work
Run both CI workflows and fix any compilation/test failures. For direct testing from an Android phone without ADB access to a development host, a different safe transport/test harness will be needed. A fully push-based Android listener, secure sign-in UX and Android instrumentation tests remain future work.

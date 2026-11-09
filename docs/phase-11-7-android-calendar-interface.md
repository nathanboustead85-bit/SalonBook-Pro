# Phase 11.7 — Development-only Android calendar interface scaffold

**Production HOLD. No deployments, no public booking enablement, no production APK changes.**

## Added
- `demo/phase117/DemoOwnerCalendarActivity.kt`: Android Activity reference outside `app/src`, with London-local appointment display, confirmed/cancelled status, empty state, ID-based row replacement and lifecycle placeholders.
- `functions/phase117DemoCalendarController.js`: emulator-only UI state adapter accepting the Phase 11.6 owner-authorised real-time feed. Handles snapshot replacement, duplicate ID rejection, reconnect with bounded retry, subscription cleanup and stale-event suppression.
- `functions/phase117DemoCalendarController.test.js`: eight emulator-gated tests covering initial display, status updates, ordering, duplicates, reconnection, lifecycle shutdown, business switching and production exclusion.

## Important limitation
The Kotlin Activity is **not compiled into a debug APK and has no network transport attached yet**. The JavaScript controller exercises the actual Phase 11.6 feed's contract using simulated listener callbacks, not a physical Android device. This phase provides a testable integration scaffold, **not verified end-to-end Android device synchronisation**. Before that claim, a dedicated debug-only Android source set and authenticated transport must be added, plus instrumentation tests on an Android emulator/device. Do not embed owner tokens or Firebase emulator endpoints in a release APK.

## Safety
No changes to `app/src`, `website/book/index.html`, `functions/index.js`, Firestore rules or production Firebase. The test workflow uses demo project `demo-boustio-legacy-init` with Firestore/Auth emulators. The protected `users/{uid}/liveData/bookings` remains untouched.

**Target:** 274 previously passing + 8 new = 282 automated tests, subject to workflow verification.

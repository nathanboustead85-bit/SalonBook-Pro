# Phase 20.9 — Integrated Firebase SDK recovery emulator tests

**Release decision: NO-GO.** No public registration, customer bookings, production Firebase deployment or Android appointment changes.

## Coverage added
- Real Firebase Auth SDK callbacks and Firestore `onSnapshot` listeners connected to the Phase 20.4 session controller and Phase 20.8 bounded retry monitor.
- Real Firestore SDK `disableNetwork` / `enableNetwork` against the isolated demo project emulators.
- Verified owner profile recovery only after a fresh server-confirmed snapshot, including changes written during an outage.
- Account switch through real Auth SDK while Firestore is offline, with cross-owner profile isolation.
- Repeated offline events, listener teardown, pending retry cancellation and safe reconnection.
- Three integrated tests added to GitHub Actions alongside the previous 33 tests.

## Limitations
Connectivity notifications and timer scheduling are injected test adapters, not actual browser connectivity detection or production background scheduling. Real SDK network functions and Auth events are used, but tests run in Node rather than Samsung/browser. Tests must pass in GitHub Actions before Phase 20.9 can be marked verified. Production feature flags remain disabled.

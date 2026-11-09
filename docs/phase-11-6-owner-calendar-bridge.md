# Phase 11.6 — Emulator-only business calendar integration contract

**Production HOLD.** Nothing in this phase is exported from `functions/index.js`, deployed to Firebase or connected to the live Android APK. Production website remains preview-only.

## Implemented and tested
- `functions/phase116OwnerCalendarBridge.js` projects synthetic customer website bookings into a stable Android-calendar-friendly JSON model: `id, source, serviceId, staffId, startAt, endAt, status, localDate`.
- Read-only owner calendar snapshots and Firestore real-time listeners. Confirmed and cancelled booking status is reflected as updates to the same booking ID, not duplicate rows.
- `functions/phase116OwnerAuthorizer.js` verifies a Firebase Auth emulator ID token and verified email, and matches its UID to `phase113DemoBusinesses/{businessId}.ownerUid`. Customer tokens and unrelated business owners cannot read the feed.
- `demo/phase116/DemoCalendarProjection.kt` provides an isolated Kotlin calendar-view projection example using replace-by-ID semantics. It is **not wired into the production Android app**.
- Eleven isolated integration tests: initial empty feed, website-to-calendar projection, idempotent replay, distinct appointments, owner access, cross-business denial, forged token, live updates, booking status, invalid date, protected legacy source and non-export safety.

## Data and safety
All demo records remain in `phase113DemoBusinesses/demo_*` inside the Firestore emulator. The bridge does not create or modify appointments; the Phase 11.3 booking engine remains the only booking writer. It never reads or writes `users/{uid}/liveData/bookings` or production migration documents.

## Still required before actual Android integration
1. Wire the calendar model to a dedicated Android debug/emulator-only build variant with explicit connection to the demo environment.
2. Add UI-level Android tests for real-time display, reconnection, local timezone presentation and status updates.
3. Define secure production owner API, access control, lifecycle handling and offline behaviour. Do not ship emulator credentials or allow a release APK to access this prototype.
4. Reconcile owner calendar, staff schedules and customer booking data through an approved migration design without altering existing production bookings.

**Target:** 263 previously passing + 11 new = 274 tests, subject to GitHub Actions verification.

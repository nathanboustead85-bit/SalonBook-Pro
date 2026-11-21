# Phase 35.1 — Actual Firestore rules, isolated emulator

Runs the **repository's real firestore.rules** against an isolated Firestore emulator using the demo project `demo-boustio-phase35-1`, localhost port 18080, with the existing `firebase.phase32-4.json` config. Seeded demo documents are written **only through security-rules-disabled emulator test setup**, never production. Actual client SDK `getDoc` reads are verified for `users/{uid}/business/profile`, `users/{uid}/liveData/services`, and `users/{uid}/liveData/staff`. Verified owners succeed; anonymous, unverified and cross-owner reads fail. Real Firestore Timestamp objects are normalized and passed through Phase 34.3's read-only mapper.

**Important known rule behaviour:** Existing `users/{uid}/liveData/bookings` rules permit verified-owner reads, and may permit legacy writes. This phase does not alter those rules, read real booking data, or claim global booking isolation. The test uses only a dummy booking document inside the emulator. The dashboard mapper deliberately excludes bookings.

**Still blocked:** This is not production Firebase, no trusted SDK gateway is wired into the app, the three sequential reads are **not atomic**, and `consistentRead:true` in the test is only an assertion. Phase 34.1's provisional path/revision gateway remains incompatible with the inspected schema. Before real integration, validate atomic consistency design, authentication and App Check, cancellation, freshness policy and schedule semantics.

No production credentials, live bookings, payments, messaging, Android appointments, rules deployment or hosting deployment are accessed. CI runs only emulator and offline tests.

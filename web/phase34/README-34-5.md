# Phase 34.5 — Final isolated dashboard integration audit

This audit composes the actual Android/Firestore path mapping (34.2), timestamp validation (34.3), and recovery state machine (34.4). It tests verified-owner data, invalid and cross-owner documents, missing/extra documents, freshness, stale-data clearing, terminal permission errors, and bounded transient retries. All success results are explicitly **OFFLINE_AUDIT_ONLY** with `productionApproved:false`.

## Findings and blockers
1. **34.1 mismatch:** the original isolated gateway assumes `businesses/{uid}`, an `ownerId` envelope and a shared `revision`; the inspected actual private profile is `users/{uid}/business/profile` and the liveData documents store `json`, `schemaVersion`, and independent `updatedAt`. Do not connect 34.1 directly to production.
2. **Atomic consistency not established:** `consistentRead:true` is caller-supplied, not proof of a Firestore snapshot. Independent timestamps and a five-minute skew limit are not atomic version control.
3. **No real Firebase adapter:** Phase 34 has no SDK initialization, network access, trusted auth verification, or Firebase emulator rules enforcement.
4. **Schedule completeness:** staff-specific weekly schedules are present, but a verified persisted business-wide opening-hours schema and full schedule semantics are not established.
5. **Retry integration:** callback coordination, in-flight cancellation, and retry scheduling must be tested against an actual adapter; the offline recovery machine currently transitions mismatched callbacks to unavailable and does not cancel promises.
6. **Policy:** 24-hour maximum document age and five-minute skew are provisional and may hide legitimate, unchanged salon records.

## Safety
No booking documents are read or written. No Android appointments, production Firestore rules, Firebase config, payments, messaging, or deployment are touched. Live features remain disabled. A green GitHub Actions run means isolated code and regression tests passed; it does **not** approve live customer bookings or production Firebase integration.

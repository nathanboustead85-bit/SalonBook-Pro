# Phase 31.1 — Read-only business data integration foundation

This is an **isolated, offline staging contract**, not a connection to production Firebase. The fixture is illustrative and contains no real customer data. The pure JavaScript adapter validates and freezes supplied business profile, service, staff and weekly opening-hours records. It does not fetch or subscribe to Firestore and cannot write bookings.

## Source-of-truth boundary

Phase 31.1 does **not** claim that the existing Android app and Firestore use this schema. Before connecting a staging Firestore reader, inspect the actual current collections, owner isolation rules, published catalogue schema, authentication and data freshness semantics. Add a separately reviewed, read-only mapper and tests for the real schema; do not grant new production permissions.

## Safety gates

- No network, Firebase SDK, credentials, storage, uploads, payments, messaging, writes or deployment.
- No production reads or live appointment writes.
- No modification to Android files or the two existing appointments.
- The booking preview from Phase 30 remains offline and unchanged.
- Snapshot is validated and copied into frozen plain objects. Unknown fields (including customer information) are ignored.
- This adapter is **not** a security boundary: Firestore authorization must be enforced server-side when a future staging connection is considered.

## Next steps

Review the existing business catalogue/profile/owner rules and implement a staging-only authenticated read adapter behind an explicit launch-disabled feature flag, then test isolation and error states with the Firebase emulator.

# Phase 26.13 — Firestore emulator integration of atomic messaging budgets

Real Firestore emulator and Firebase Admin SDK tests exercise the actual customer chat callable handlers with mocked request identity. In isolated tests only, both chat and the abuse-budget flag are temporarily enabled. CI environment defaults remain false; no live deployment occurs.

Coverage: fail-closed messaging, first-message atomic budget, duplicate conversation, concurrent send contention, unauthorized customer, rotating anonymous accounts against business-wide caps, per-identity quota, and no partial writes.

Remaining launch blockers: these tests simulate callable authentication rather than validate HTTP/Auth tokens; App Check is still disabled; risk-signal correlation across rotating identities is not integrated; TTL cleanup and operational abuse monitoring remain outstanding. Business-wide limits alone can cause false positives. No production credentials, no existing appointment changes.

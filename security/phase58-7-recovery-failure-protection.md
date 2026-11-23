# Phase 58.7 — Recovery failure protection (synthetic only)

Seven Robolectric tests exercise disposable, randomly named SharedPreferences, never the production `salonbook_data` namespace.

Cases: malformed JSON, duplicate booking IDs, missing staff data, oversized services, injected pre-commit exception, a successful three-field synthetic commit, and invalid retry after success. The fixture validates before writing and uses a single editor `commit()`.

**Evidence limits:** This is not a production restore implementation, not a real Android process death or device test, and does not simulate a failed `commit()` or disk exhaustion. A fresh SharedPreferences handle in one JVM does not prove survival of an actual OS process kill. `CloudActivity` remains unchanged. No real bookings, Firebase data, active Firestore rules or deployment are touched.

All G1–G7 remain OPEN. Live bookings, payments, messaging, App Check enforcement and deployment remain disabled.

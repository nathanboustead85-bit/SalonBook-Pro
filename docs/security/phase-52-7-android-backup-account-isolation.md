# Phase 52.7 — Android backup account isolation

**Development branch only; not deployed.** `CloudActivity.kt` now makes both backup and restore preview-only. Backup reads local preferences and displays record counts; it does **not** call Firestore `set`. Restore reads the user's cloud backup and displays counts; it does **not** modify local preferences. Both flows capture a UID and recheck the signed-in verified account. Both validate JSON array syntax and size. Backup/restore functionality is intentionally suspended until independently verified owner isolation, rollback and overwrite protections are available.

**Limits:** UI checks are not a substitute for published Firestore rules or backend authorization. Android `allowBackup=true` remains under review. No live Firebase calls were made to test this phase; source assertions are not instrumented tests. The installed Samsung app is unchanged, and the two original appointments have not been accessed.

**Safety:** All seven launch blockers OPEN. No deployment, live bookings, payments, messaging, App Check enforcement, IAM/rules changes, or draft PR merge.

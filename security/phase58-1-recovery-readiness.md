# Boustio Phase 58.1 — Android recovery readiness

## Purpose
Review actual Android cloud backup/restore code and prevent accidental enabling of unverified recovery.

## Findings from source
- `CloudActivity.backup()` reads locally stored `bookings`, `services`, `staff` JSON strings and **only previews counts**. It does not write a cloud document.
- `CloudActivity.restore()` fetches the server document `users/{uid}/backups/latest` for a **preview**, checks verified identity, schema version 1, string fields and parses arrays. It does not write local preferences.
- The Phase 57.9 candidate rules are compatible with these field names but **cannot validate the JSON strings** or ensure a safe local commit.
- The candidate rules are not deployed. Existing Android appointments must not be accessed or modified.

## Next verification tasks
1. Inventory historical backup document shapes using a separately authorised, strictly read-only staging environment; never access real customer data by default.
2. Design a disposable-device recovery harness and atomic local rollback with synthetic data.
3. Independently verify all launch blockers and obtain explicit approval before changing active rules, live backups or production access.

**Current outcome:** source-contract evidence only. No real Android restore test, no on-device rollback proof, no production authorisation. All G1–G7 OPEN.

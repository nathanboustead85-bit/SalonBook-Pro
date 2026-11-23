# Phase 58.8 — Android recovery integration readiness

## Inspected source and actual boundaries
- `MainActivity.kt`: reads and writes the `bookings` string in `getSharedPreferences("salonbook_data", MODE_PRIVATE)`. Its normal `saveBookings()` uses `apply()` and `loadBookings()` clears and reloads its in-memory list.
- `CloudActivity.kt`: uses the same preferences namespace, previews local backup counts, and reads `users/{uid}/backups/latest` using Firestore `Source.SERVER` for restore preview. Restore preview does **not** write preferences; cloud backup does **not** write Firestore.
- `RecoveryPreviewValidator.kt`: isolated pure validation of schema 1, arrays and unique booking IDs. It is **not wired** into `CloudActivity`.
- The validator's per-field 500,000-character limit differs from CloudActivity's preview 1,000,000-character limit. Reconcile only after verifying actual backup sizes, production rules and compatibility.

## Blockers before real restore
1. Specify and independently approve production restore consent, account isolation, exact data contract and overwrite/rollback behaviour.
2. Design crash-safe, recoverable, multi-key persistence for `bookings`, `services` and `staff`; ordinary `apply()` and a one-editor Robolectric fixture are not proof of device crash safety.
3. Validate all records against real Android booking/service/staff parsers, including legacy formats and data limits.
4. Test with disposable app data on a physical Samsung device, including OS process termination, storage pressure, failure injection and restart.
5. Independently review security and close G1–G7 using real evidence before any production enablement.

## Scope and safeguards
This phase adds **read-only source-contract checks** and documentation only. It does not change production Android classes, restore any data, connect Firebase, deploy rules, or enable live features. Your two original Android appointments remain outside all test fixtures. All seven launch gates remain OPEN.

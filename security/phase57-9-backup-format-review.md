# Phase 57.9 — Android-compatible secure backup candidate

This isolated candidate uses the exact field names read by `CloudActivity.restore()`: `bookings`, `services`, `staff`, `schemaVersion`. It accepts version 1 and optionally `updatedAt`, and requires a verified owner, restricts fields, limits each data string to 500,000 characters and forbids deletes.

## Important limits
- Firestore rules **cannot validate that a string contains a valid JSON array**. Android restore preview validates with `JSONArray`, but future write paths must also validate content before upload and before restore.
- Existing historical cloud backup document schemas and any other Android backup code paths have not been exhaustively inspected. Do not claim universal compatibility.
- The candidate is a **design**, not a deployed change. No actual cloud backups or Android preferences are modified.
- Backup overwrite safety, atomic restore, rollback and original appointment preservation require independent end-to-end verification before enabling writes.

## Next acceptance criteria
Inspect all app backup readers/writers, use synthetic migration fixtures, verify rollback, and test a disposable Android installation before seeking independent approval. G1–G7 OPEN; live bookings, payments, messaging, App Check enforcement and deployment remain disabled.

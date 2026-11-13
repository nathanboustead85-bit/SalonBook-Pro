# Phase 12.31 — Isolated Firestore backup and restore drill

The GitHub Actions workflow runs only against the local Firestore emulator with the dedicated `demo-boustio-phase1231` project. The test refuses to run without both the expected emulator host and project ID.

The test writes two sample appointments to a disposable source, seals a JSON snapshot with SHA-256, persists the backup in a separate emulator collection, verifies its checksum, and restores into a different disposable destination. It compares source and restored appointments exactly, checks repeat restores are rejected, rejects corrupted/missing/duplicate-ID backups, preserves existing destination records on conflict, and removes test data.

**Limitations:** This is a Firestore emulator drill, not a production disaster recovery drill. The backup is stored inside the same disposable emulator, not immutable external storage. It does not establish production backup retention, actual live restore safety, IAM, disaster recovery objectives or approval for migration. No live bookings are enabled or modified. Production readiness gate must remain NOT_READY until independent evidence is gathered.

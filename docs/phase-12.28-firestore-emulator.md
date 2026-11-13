# Phase 12.28 — Firestore emulator transaction rehearsal

**No production deployment or migration is authorised.**

The GitHub Actions workflow runs against the disposable Firestore emulator with project ID `demo-boustio-phase1228`. The test code refuses to run unless the expected emulator host and project are set.

## Rehearsal coverage
- Create two disposable appointments and validate a sealed SHA-256 backup snapshot.
- Inject exceptions after the first and second transaction writes and assert no appointment, lock or marker persists.
- Reject a simulated pre-commit conflict.
- Preserve existing appointments and booking locks on conflicts.
- Verify a successful emulator transaction creates all expected appointments, locks and marker together.
- Reject a repeated migration attempt, with no duplicates.
- Verify legacy JSON remains unchanged and live bookings remain disabled.
- Remove the disposable emulator records.

## Scope limitations
This is a **test-only transaction rehearsal**, not the production migration implementation. It does not test concurrent real customer traffic, production IAM, live Firestore rules, recovery from a partially deployed release, or restoration from a durable offsite backup. Future migration code needs separate design review, a versioned immutable backup, owner consent, emulator concurrency tests and a verified recovery runbook before any live writes.

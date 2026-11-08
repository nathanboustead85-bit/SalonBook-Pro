# Boustio Phase 10.37 — Production legacy-mode initialization readiness

Status: **PREPARATION ONLY — NO PRODUCTION EXECUTION APPROVED**.

## Scope
Future approved operation, if separately authorized: create exactly one Firestore document
`businesses/{authenticatedOwnerUid}/settings/bookingMode`
with `mode: "legacy"`, `schemaVersion: 1` and timestamp.

Do NOT delete, freeze, migrate, enable public bookings, alter appointments or booking locks, or modify `users/{uid}/liveData/bookings`.

## Evidence observed (2026-11-08; snapshot, not a permanent guarantee)
- Dedicated read-only service account used for independent Firestore REST reads.
- Booking mode document absent (HTTP 404).
- Migration marker `android-bookings-v1` absent (HTTP 404).
- Shared appointments list empty.
- Booking locks list empty.
- Legacy booking source schemaVersion 1; 10 records.
- Legacy booking JSON SHA-256:
  `04a6dba89d20d788d6f5f7fd56f68427ca14a6f4aa83d07fe1c80e996adbbe19`.
- Independently saved, verified archive matched that hash.
- Isolated Firestore emulator safety workflow run 42523370332: 13/13 passing.

These are observations only; live state must be rechecked at execution time.

## Mandatory preconditions for any later execution
1. Obtain **new, explicit, operation-specific approval** from the business owner. Approval of this checklist, test runs or code changes is NOT authorization.
2. Use only trusted backend credentials in a restricted, authenticated, audited execution environment; no public callable or GitHub Actions workflow should accept arbitrary client-provided approval as sufficient authentication.
3. Verify authenticated Firebase owner UID matches the target business ID, and archive `sourcePath` equals `users/{uid}/liveData/bookings`.
4. Verify saved archive type, schema, unique record IDs, count 10, SHA-256 and exact source content. Never print or commit customer booking JSON or credentials.
5. Re-read from production immediately before the operation: mode absent, migration marker absent, appointments empty, locks empty, cloud source schema 1 and SHA-256 exactly matches verified archive.
6. Ensure no other booking writers or pending device uploads could race with initialization. Coordinate a maintenance window if necessary; don't freeze bookings without separate approval.
7. Check the operation uses a Firestore transaction, all reads before the sole write, and fails closed on missing permissions, changed state, or errors.
8. Confirm the service identity used for any eventual write has only the minimum necessary privileges; the **read-only verifier must never be upgraded** for this task.
9. Dry-run and review the exact target path, intended document body, backup location, and rollback procedure with the owner.
10. After separately approved execution, verify only the bookingMode document was created and that legacy bookings, appointments, locks, and migration marker remain unchanged.

## Current code controls
- `functions/controlledLegacyModeInitialization.js` is not a public endpoint and is not deployed.
- `executionEnabled` defaults to `false`.
- Separate approval phrase required by function (but a string alone is NOT adequate real-world authorization).
- Validates authenticated owner, archive source path and archive integrity.
- Checks existing mode, marker, shared appointments/locks, cloud source hash inside transaction.
- On success, only creates bookingMode document.
- Emulator tests include invalid owner, wrong archive, stale source, repeat invocation, disabled execution, missing approval, marker, appointments and locks.

## Explicitly NOT done in Phase 10.37
- No production Firestore writes or deployments.
- No booking deletions, migration or freezing.
- No enabling public customer bookings.
- No use of the production archive in GitHub.
- No production execution credentials stored in GitHub.

## Decision
**HOLD**. Preparation completed; production initialization remains blocked until a new explicit authorization and just-in-time checks.

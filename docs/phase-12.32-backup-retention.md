# Phase 12.32 — Versioned backup retention rehearsal

This is an **emulator-only test**, not a deployed production backup feature. It uses project `demo-boustio-phase1232` and refuses to run without the local Firestore emulator.

The test creates three sealed, checksummed backup versions, verifies historical restore data, chooses the newest valid version, rejects duplicate version creation, rejects unapproved deletion requests, records an approved request without deleting data, skips a corrupted latest version and preserves older versions, verifies audit events, and cleans up test data.

## Important boundaries
The test-only deletion guard is a helper in the test script, **not** an enforced Firestore security rule or IAM protection. An administrator with database access could still delete or modify the emulator records. A production solution requires independently secured immutable storage, retention policy, audit access controls, documented deletion approvals, restoration drills, and a review of Firestore rules/IAM. Phase 12.30 production readiness remains NOT_READY. No live data or original appointments are changed.

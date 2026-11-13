# Phase 12.30 — Production migration readiness checklist

**Current decision: NOT READY for live migration.** Passing emulator tests is not permission to migrate customer data.

## Evidence required before independent release review
- [ ] Verified owner consent recorded for the exact business and migration scope
- [ ] Immutable, versioned backup stored outside the records being migrated
- [ ] SHA-256 integrity of the actual backup verified
- [ ] Restore drill completed against a separate environment
- [ ] Production Firestore security rules reviewed
- [ ] Production migration transaction implementation reviewed
- [ ] Concurrent writes and repeated requests protected
- [ ] Rollback runbook reviewed and approved
- [ ] Monitoring, alerts and incident response ready
- [ ] Explicit release approval recorded

Each gate needs a passed flag, evidence ID, reviewer, and timestamp. The automated policy returns NOT_READY if any evidence is missing or malformed. Even complete evidence returns REVIEW_REQUIRED, **never permission to deploy or migrate**.

## Evidence currently available
- Phases 12.26–12.27: offline inspection, backup integrity and simulated rollback tests passed.
- Phase 12.28: isolated Firestore emulator transaction and failure injection tests passed.
- Phase 12.29: isolated Firestore emulator concurrent migration and conflict tests passed.
- Phase 12.30: readiness policy automated tests pending workflow execution.

These are development test results only, not evidence of a durable live backup, successful production restore drill, owner consent, approved production transaction code, or operational incident readiness.

## Safety boundaries
No APK installation, Firebase deployment, production writes, live booking activation or owner data migration in this phase. Preserve both original DEV appointments and the disabled live-booking state.

# Boustio Phase 57.1 — Staging recovery readiness

**Status:** PLANNING ONLY; NOT APPROVED for real staging execution.
**Starting point:** Phase 56.1–56.5 offline simulation workflows passed. These are not evidence of real crash recovery, Firebase transaction atomicity, or cross-device locking.

## Independent evidence to collect before any staging run

1. **Environment isolation:** confirm staging Firebase project ID, billing caps/alerts, separate service identities, and zero routes to production collections. Capture reviewed configuration evidence without secrets.
2. **Access review:** least-privilege permissions, credential lifetime, no credentials committed to GitHub, two-person review of privileged actions.
3. **Synthetic data:** use a disposable dataset created specifically for staging; never import or touch the two original Android appointments.
4. **Concurrency:** independently review durable revisions, idempotency and cross-device exclusion before running simultaneous clients.
5. **Failure injection:** document process termination, network partition, stale revision, duplicate request, retry, partial writes, corruption and restoration procedures. Do not execute until separately approved.
6. **Observability and recovery:** establish safe backup, rollback and audit logging, with named reviewers and pass/fail evidence.
7. **Approval gate:** record explicit owner approval and independent review of all prerequisites. This document does not grant permission.

## Test evidence matrix (future, not yet executed)

| Scenario | Expected safety property | Evidence required |
| --- | --- | --- |
| Two devices prepare concurrently | At most one authorized recovery | Staging transaction logs and repeatable test |
| Process killed before commit | No partial writes | Before/after data hashes and restart traces |
| Network disconnect during commit | Consistent final state and safe retry | Backend logs, revision and idempotency records |
| Corrupt or stale snapshot | Rejected without data changes | Rejection trace and unchanged hashes |
| Duplicate request after restart | No duplicate effects | Durable request history and before/after comparison |
| Backup rollback | Original staging dataset restored | Verified backup hash and independent reviewer |

## Non-negotiable safeguards

- Existing launch blockers **G1–G7 stay OPEN**.
- Deployment, live bookings, payments, messaging and App Check enforcement stay **disabled**.
- Original Android appointments remain **DO_NOT_TOUCH**.
- No staging project is accessed or changed in this phase.
- Passing planning checks is **not** permission to execute the staging plan.

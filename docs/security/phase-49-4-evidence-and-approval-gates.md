# Boustio Phase 49.4 — independent evidence and approval-gate preparation

**Status: PREPARATION ONLY. All seven launch blockers remain OPEN. No independent approval has been given.**

## Non-negotiable boundaries
No production access, production credentials, production writes, Android data changes, migrations, releases, deployments or feature enablement. Preserve the two original Android appointments. Live bookings, payments, messaging and deployment stay disabled. Use synthetic identities in isolated demo emulators; real staging work requires separate authorization and human review.

## Evidence submission requirements
For every control record: control ID, exact scope and environment/project ID (redacted if sensitive), immutable source commit SHA, CI run URL, UTC timestamp, verifier identity and independence declaration, test plan, positive and negative test results, redacted logs, failures, remediation references, re-test results, residual risks, and independent signed decision. Store raw evidence in a restricted approved location, never in public repository artifacts or comments. Record only redacted summaries and secure evidence references.

## Independent verifier checklist
- [ ] Reviewer is different from implementation author and has no conflict of interest.
- [ ] Staging project is isolated from production with least-privilege access.
- [ ] Firebase Admin revocation is tested with checkRevoked enabled; document the Firestore Rules token-expiry limitation.
- [ ] Expired, disabled, missing, forged and revoked sessions are rejected by the appropriate backend.
- [ ] Cross-owner reads and writes are denied in rules AND independently in server handlers (Admin SDK bypasses rules).
- [ ] Privileged credentials are restricted to server-side workloads, with IAM review and rotation plan.
- [ ] Failure paths, audit trails and rollback are independently tested.
- [ ] Evidence has verifiable provenance, is sanitized, and includes reviewer signoff.

## Approval rules
Each of LB-1 through LB-7 must have its own reviewed evidence package. A green emulator run or this preparation phase cannot close a blocker. A future approval requires explicit authorized human action, independent reviewer signoff, secure evidence provenance, resolved critical findings, and staging validation. Any missing, stale, inconsistent or unsigned evidence = FAIL CLOSED / PENDING. The machine-readable gate file intentionally contains no approvals.

## Evidence record template
```text
Control ID:
Launch blocker ID:
Verifier / independence statement:
Environment and isolation proof:
Source SHA / workflow URL / UTC:
Exact reproduction commands:
Positive results:
Negative results:
Findings and remediation:
Redacted evidence reference (restricted access):
Residual risks:
Independent decision: PENDING
Authorized approval: PENDING
```

## Outcome
Passing automated gate checks means the *preparation safeguards* work. It does not prove live backend security, verify real Firebase Admin revocation, authorize deployment or change the seven OPEN blockers.

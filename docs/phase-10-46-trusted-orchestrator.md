# Phase 10.46 — Trusted Security Orchestrator (emulator only)

**HOLD: No production execution approval.**

`functions/phase1046TrustedOrchestrator.js` adds a non-exported-from-index server-side orchestration factory. The only request keys accepted by `issue` are `businessId`, `archive`, `approvalId`, `ownerToken`, `operatorAssertion`. The only request keys accepted by `consume` are `businessId`, `archive`, `approvalId`, `ownerToken`. Unexpected keys fail closed.

The factory snapshots its trusted Ed25519 public-key registry at construction and validates the keys. Both operations use the server's `Date.now()`, Firebase Admin `verifyIdToken(token,true)` against the Auth emulator, and the existing Phase 10.41 issuance/10.40 consumption transactions. The operator signature is verified against the registry, never a request-supplied public key. The orchestrator requires both emulators, the exact demo project and absence of application credentials.

`functions/phase1046TrustedOrchestrator.integration.test.js` exercises the genuine Auth emulator, signed approvals, identity/clock/verifier/key substitution, key-registry mutation, forged signatures, replay, cross-owner consumption, and environment locking.

## Remaining risks
- Factory construction remains an internal trust boundary: the application must ensure only trusted bootstrap code can create the orchestrator and provide the registry. Do not export this factory through a request handler.
- Underlying Phase 10.40/10.41 functions still allow injected callbacks if called directly. They must remain unexported and ultimately be retired or made private.
- Key material remains test-generated, with no external key management, independent operator identity service, or protected key rotation authority.
- Issuance audit records remain in Firestore and are not independently immutable; the signed operator assertion is not persisted in the Phase 10.41 audit record.
- Approval consumption writes two Firestore documents (approval update and bookingMode creation); future production scope must be independently approved.
- No production IAM or independent audit storage has been validated.
- Emulator-only security is not evidence of production deployment readiness.

**Never deploy, modify production Firebase, delete or freeze bookings, or enable public bookings as part of this phase.**

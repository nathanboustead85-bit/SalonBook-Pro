# Boustio Phase 10.45 — Final security boundary review

**Decision: HOLD. Emulator prototypes are not production-ready. No production execution authorised.**

## Review of Phases 10.38–10.44

### CRITICAL — callback injection
The Phase 10.40 consumer accepts a caller-provided `verifyIdToken` callback and Phase 10.41 issuer accepts caller-provided `verifyOwnerToken` and `verifyOperatorAssertion` callbacks. Even though Phase 10.43 implements Firebase Auth emulator verification and Ed25519 checks, nothing forces the earlier APIs to use those implementations. A caller with access to the internal module could inject a permissive verifier. **Remediation:** introduce a non-injectable, server-owned orchestration boundary and restrict all entry points to a trusted server.

### CRITICAL — trusted clock
The issuance, consumption and revocation APIs accept `nowMs` from the caller. A caller can supply an artificial time to make expired approvals appear valid. **Remediation:** use server-controlled time from the execution environment; for transactions, cross-check server timestamps and approval lifetime.

### HIGH — operator key custody
The signed operator assertion is cryptographically checked in Phase 10.43/10.44, but the public key registry is passed in as a mutable parameter, and the tests generate and own signing private keys. The code does not establish operator identity, authorised key provisioning, key rotation approval, or secure private key storage. **Remediation:** independently provision pinned trusted public keys; protect signing keys with managed KMS/HSM; verify operator role and key status from trusted infrastructure.

### HIGH — immutable audit
Phase 10.41 records a plain SHA-256 evidence digest; Phase 10.44 adds Ed25519-signed revocation records. Neither mechanism provides an independently immutable audit trail. A privileged actor can delete both approval and audit records. **Remediation:** send events to a separately controlled append-only audit system with retention, integrity verification and independent access controls.

### HIGH — Admin SDK permissions
The Firestore Admin SDK bypasses client Firestore Security Rules. No least-privilege service identity or IAM enforcement has been validated for the future execution mechanism. **Remediation:** independently review service identity and IAM permissions; require two-person approval and a separate execution gate.

### HIGH — approval write scope
Phase 10.40 writes both an approval-consumption update and the bookingMode document. Phase 10.41 creates approval and audit documents, while Phase 10.44 writes revocation and audit records. This is **more than the earlier one-document production-write scope**. Any future production process needs a new explicit scope and independent approval, not a silent extension of earlier consent.

### MEDIUM — unsigned or partially bound evidence
Phase 10.41's approval record stores the operator ID and an unkeyed digest but does not persist the full signed operator assertion, nonce, key ID or verified signature. Phase 10.40 only checks stored flags and does not revalidate a signature. The signed-assertion verifier checks a nonce but has no independently protected nonce-consumption ledger. **Remediation:** persist and bind signed evidence to the exact approval; independently verify it at consumption; track nonce use transactionally.

### MEDIUM — transaction/query concurrency
Approval creation and consumption are atomic within the emulator, but empty collection queries and live booking writers need a broader race analysis. A future booking writer may not share the same lock/transaction invariants. **Remediation:** review all booking write paths and use a server-controlled mode gate with emulator race tests.

## Regression test coverage
The Phase 10.45 static tests assert no security prototype is exported from the production Functions index, emulator-only environment checks remain, transaction-state guards exist, signing-key status checks remain, and the original booking document is never written by the approval consumer.

**Static tests do not prove a secure production trust boundary.** Prior 92 passing tests cover emulator behaviour only. This review records the gaps rather than claiming that they are solved.

## Next recommended work
Implement a single, emulator-only trusted orchestrator that does not accept arbitrary verifier callbacks, keys, or time from requests; add adversarial tests for clock spoofing, callback injection, forged registry and audit deletion. Do not deploy or enable public bookings.

**No production Firebase writes, deployments, booking deletion, freezing or public booking activation.**

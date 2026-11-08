# Phase 10.50 — Production security architecture and least-privilege review

**Decision: HOLD. Design and test only. No production IAM or Firebase configuration changes.**

## Current flow and trust boundaries
1. Owner presents a Firebase ID token. Phase 10.46 checks verified email through Firebase Admin Auth. This proves the token's Firebase identity, not operator authority.
2. Trusted emulator orchestrator receives a signed Ed25519 operator assertion and checks a registry supplied at trusted construction time. The registry is currently test-provided, not a secure production trust store.
3. Phase 10.48 verifies scope, expiry and archive digest. Issuance transaction creates **four** Firestore documents: approval, approval audit, project-wide operator nonce, and Phase 10.49 audit anchor.
4. Consumption rechecks the signed evidence, audit, anchor and nonce ledger, checks owner/source and empty shared collections, then transactionally **updates approval status and creates booking-mode document**. Existing legacy bookings are read but not written.
5. These documents all live in one Firestore administrative trust domain. SHA-256 anchors are not independently immutable. An Admin SDK principal with sufficient Firestore access can bypass Firestore Security Rules.

## Proposed separation of duties (not configured)
| Principal | Intended permission | Must not have |
| --- | --- | --- |
| Customer/owner client | Firebase Auth and narrowly scoped user operations | Signing keys, audit writer, approval issuance, mode creation |
| Approval issuer | Verify owner and signed operator evidence; issue scoped approval and nonce atomically | KMS signing, general database admin, booking mutation |
| Approval consumer | Read verified approval/evidence/source; atomically consume approval and create mode | KMS signing, general database admin, booking mutation |
| Operator signing service | Hardware-backed KMS/HSM signing after independent operator authorisation | Firestore write access and audit administration |
| Independent auditor | Read independently stored signed events and verify chain/integrity | Signing, event alteration or deletion |
| Deployment administrator | Restricted deployment and identity binding under change control | Day-to-day signing authority or audit deletion |

**IAM caveat:** Google Cloud Datastore/Firestore IAM permissions are not necessarily enforceable at the document-path granularity implied by the table. Do **not** grant a broad Firestore role assuming it limits access to those paths. Use separate projects/databases/services, narrowly controlled execution identities, application checks and external audit boundaries; have a security reviewer verify actual IAM enforcement. Firestore Rules do not constrain Admin SDK service accounts. No IAM roles were assigned.

## Proposed independent audit
- An independently administered append-only or WORM audit destination, with retention/hold and separate IAM, is mandatory before production approval.
- Include canonical signed event payload, approval ID, nonce digest, key ID, source hash, actor, timestamp and result. Never log raw owner ID tokens, private keys or unnecessary client personal data.
- Verify event receipts and reconciliation with the Firestore ledger; fail closed when the audit service is unavailable.
- Document audit key rotation, retention, alerting, incident response and independent periodic review.
- **No external audit destination, retention lock or independent verification is currently configured.**

## Proposed signing-key custody
- Private keys never belong in repository files, workflow secrets, test fixtures used in production, or application environment variables.
- Prefer non-exportable hardware-backed signing keys under Cloud KMS/HSM or equivalent, with an independently managed operator signing identity and audited sign permission.
- Bootstrap trusted public-key registry from a controlled, versioned trust store; pin identities, algorithm, expiry and revocation. Separate key administration from application deployment and Firestore administration.
- Establish emergency revocation, rotation overlap, disaster recovery and dual-control approval. Do not assume Ed25519 is supported by a chosen KMS/HSM offering; confirm supported signing algorithms and adapt the protocol before deployment.
- **No production KMS keys, signer, or trusted bootstrap have been provisioned.**

## Exact current prototype Firestore write set
Issuance: `businesses/{businessId}/legacyModeApprovals/{approvalId}`, `businesses/{businessId}/legacyModeApprovalAudit/{approvalId}`, `businesses/{businessId}/legacyModeAuditAnchors/{approvalId}`, `legacyModeOperatorNonces/{nonceHash}`.

Consumption: update `businesses/{businessId}/legacyModeApprovals/{approvalId}`; create `businesses/{businessId}/settings/bookingMode`.

No writes to legacy bookings, appointments, booking locks, or migration markers. Existing historical prototypes and other functions require independent review before any deployment.

## Go/no-go criteria
- Independent architecture, threat-model and IAM review including privilege escalation and insider compromise.
- Real enforced separation of issuer, consumer, signer and independent audit administrator.
- Immutable external audit, failure/recovery tests and receipt reconciliation.
- Hardware-backed or equivalently protected key custody, trusted registry bootstrap and rotation/revocation tests.
- Explicit owner and operator authorisation and independently approved write scope.
- Comprehensive production-like staging tests, backup and rollback plan, monitoring and incident response.
- New explicit user authorisation for any production deployment or write.

**No-go remains in effect.** This phase adds documentation and static tests only. No functions deployed; no production Firebase writes, booking deletion/freezing or public booking activation.

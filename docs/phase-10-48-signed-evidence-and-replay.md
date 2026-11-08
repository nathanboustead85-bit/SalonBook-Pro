# Phase 10.48 — Signed approval evidence and nonce replay protection

**Emulator-only. Production HOLD.**

The Phase 10.46 trusted orchestrator now delegates issuance and consumption to `functions/phase1048SignedApproval.js`, rather than the older callback-injectable Phase 10.40/10.41 prototypes.

- Issuance validates a real Firebase Auth emulator owner token via the orchestrator, verifies an Ed25519 assertion against the orchestrator-owned registry, and transactionally creates the approval, audit, and project-wide operator nonce ledger entry. Nonce document ID is SHA-256 of operator ID + separator + nonce. A repeated nonce cannot issue a second approval even with a different approval ID or business.
- The approval and audit persist the signed assertion and its SHA-256 digest. Consumption re-verifies the signature, owner, operation, archive digest, key status and expiry, compares approval and audit evidence, checks the nonce ledger, checks source bookings and empty shared collections, and transactionally consumes the approval while creating the legacy mode document.
- New adversarial tests extend the existing real Auth + Firestore emulator suite with six scenarios, including concurrent replay attempts.
- Legacy Phase 10.40/10.41 modules remain gated and unexported; production index remains unchanged.

## Unresolved security and readiness limits

This is **not** a deployable or independently authorised production workflow. The signing-key registry is test-controlled and no independent operator identity or secure key custody exists. Firestore Admin privileges can delete or rewrite approval, audit and nonce documents; no immutable audit system exists. The orchestrator factory still accepts a trusted registry at construction, so trusted bootstrap control is required. Transactional nonce replay protection only applies to paths using the new module; historical prototype paths remain test-gated but injectable. A privileged actor could delete the nonce record; production would require immutable replay tracking and restricted IAM. The design adds a third issuance write (nonce ledger) and requires fresh explicit approval of any future production write scope.

No production Firebase writes, deployments, booking deletion, freezing or public booking activation are authorised.

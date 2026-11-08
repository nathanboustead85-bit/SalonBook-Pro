# Phase 10.44 — Emulator key rotation, revocation and audit evidence

**HOLD: development-only prototype; not production-authorised.**

Added:
- `functions/phase1044KeyRotationAndAudit.js` verifies signed operator assertions against an explicit key-ID registry, rejects retired/revoked keys, verifies Ed25519-signed audit evidence, and atomically revokes an unused approval with a matching audit document in the isolated emulator.
- `functions/phase1044KeyRotationAndAudit.integration.test.js` exercises key rotation, tampering, revocation, concurrency, replay, booking preservation and project lock.
- Legacy Mode Emulator Safety workflow runs these tests with Firestore and Authentication emulators.

Security boundaries:
1. Key registry and signing private keys are **test fixtures**. No production KMS/HSM, key distribution, rotation approval, custody or independent operator authentication exists.
2. Audit signature provides **tamper detection when verified against an independently trusted key**, but records reside in the same emulator Firestore and are **not externally immutable**. A privileged actor can delete records, and key compromise permits forged evidence.
3. Key revocation is checked against the supplied trusted registry at verification time. A production system needs protected and current key-status distribution, key-ID pinning and independent key revocation.
4. Revocation prototype is not an exported callable or deployed endpoint. It is not connected to a production signing service or production IAM.
5. No production Firebase writes, deployments, booking deletion/freezing, or public booking activation.

**Do not deploy, export from functions/index.js, or run against production.**

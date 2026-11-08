# Boustio Phase 10.43 — Real emulator authentication and signed operator evidence

**Development-only. Not production-ready.**

## Changes
- `functions/phase1043TrustedEmulatorEvidence.js`: Firebase Admin `verifyIdToken(token,true)` with Auth emulator requirement; Ed25519 signature verification against an independently provided public key and canonical, owner/operation/archive/approval/nonce/time-bound payload.
- `functions/phase1043TrustedEmulatorEvidence.integration.test.js`: creates users in Auth emulator, exchanges emulator custom tokens for ID tokens, tests owner verification, signed operator evidence, tampering, wrong key, expiry, replay and preservation of ten Firestore emulator bookings.
- Existing `legacy-mode-emulator-safety.yml` now runs Firestore and Auth emulators for Phase 10.43.

## Remaining security blockers
1. The test creates its own signing key pair and supplies trusted verifier callbacks. **No production operator identity provider, trusted key provisioning/rotation, revocation, independent authorisation or secure signing service exists yet.**
2. Phase 10.41 issuer accepts injectable verification callbacks; these must be hard-wired to trusted verifiers in a server-only boundary before production.
3. Phase 10.43's signature verifier checks the signed nonce but does not itself persist a consumed-nonce ledger. The approval ID is protected from duplicate issuance by the emulator transaction, but a full assertion replay strategy requires independent review.
4. Phase 10.41 audit evidence is a checksum, not tamper-proof or externally immutable. Firestore Admin SDK bypasses Security Rules; separate IAM and external audit controls are required.
5. No deployed endpoint, production Firestore reads or writes, migration, deletion, booking freeze, or public booking activation is authorised.

**Do not import these prototypes into functions/index.js or run them against production.**

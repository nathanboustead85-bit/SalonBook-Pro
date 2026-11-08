# Phase 10.49 — Audit tamper detection and signing-key custody readiness

**Emulator-only; production HOLD.**

Phase 10.48's issuance transaction now writes an additional `legacyModeAuditAnchors/{approvalId}` document containing a digest over the business, approval, operator, archive, nonce ID and signed evidence digest. Consumption reads and verifies this anchor alongside the signed approval, audit and nonce ledger. Tests exercise deletion, alteration, identity substitution and successful consumption. The trusted orchestrator now rejects non-plain key registry objects and inherited key-record prototypes, and continues to allowlist public-key fields only (never private keys).

**This is NOT an immutable audit.** All anchor, approval, audit and nonce documents reside in the same emulator Firestore trust domain and a sufficiently privileged administrator can rewrite them together. A SHA-256 anchor cannot independently attest to history. Production readiness requires independently administered append-only/WORM storage, external anchoring or a separately held signing key, retention controls, monitoring and documented incident response. No such service is configured here.

**Key custody is NOT production ready.** The trusted registry is injected at orchestrator construction in tests. Production must load public keys from a controlled trust store; private signing keys must live outside application code and CI, preferably hardware-backed KMS/HSM with separation of duties, restricted sign permission, rotation and revocation procedures, audit and recovery controls. The legacy test gate and historical injectable prototypes remain non-production interfaces.

The added audit-anchor document changes the prototype write set and must undergo explicit least-privilege review before any deployment. No functions are deployed, production Firebase is untouched, and bookings remain unchanged and not publicly enabled.

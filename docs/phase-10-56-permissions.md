# Phase 10.56 — Emulator permissions and role separation

**Development-only; production HOLD.**

`phase1056EmulatorPermissions.js` defines a strict, default-deny role/action matrix for owner, issuer, consumer, operator and auditor. The trusted emulator orchestrator checks verified owner identity and business scope before issuance or consumption, requires the expected signing operator role, and checks the appropriate internal issuer/consumer capability. Requests still cannot inject authorizers or role grants. Eight adversarial tests cover role escalation, unknown roles, cross-business access, unverified owners, non-demo execution and orchestrator owner mismatch.

These are application-level emulator checks, **not** production IAM, separate service identities, a complete permission system or protection against direct Firebase Admin SDK access. The orchestrator retains a single privileged Admin SDK identity and does not establish true infrastructure-level least privilege. The policy must not be treated as authorisation to deploy or modify production data. No production Firebase writes, function deployment, booking deletion/freezing or public booking activation.

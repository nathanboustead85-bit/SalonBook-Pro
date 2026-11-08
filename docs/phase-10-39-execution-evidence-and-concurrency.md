# Phase 10.39 — Authorisation, permissions and concurrency preparation

**HOLD: no production execution approved or implemented.**

## Changes
- `functions/phase1039ExecutionEvidence.js` is a **pure non-executable policy evaluator**, not a production authority or credential issuer. It fails closed on absent or inconsistent operator-verified identity, fresh unused approval, exact owner/operation/project/target, and narrow create-only permission evidence. It always returns `productionWriteAllowed: false`.
- `functions/phase1039ExecutionEvidence.test.js` exercises rejection of wrong owner, reused/expired approval, wrong project/path and broad write permissions.
- Firestore emulator integration test now races two initialisation attempts and expects exactly one to create the mode.
- Existing emulator safety workflow runs all tests. It uses the demo project, not production.

## Crucial limits
- A caller can forge plain JavaScript evidence objects. This evaluator is NOT independent verification, cannot consume an approval atomically, and must never be treated as authorisation for production writes.
- Firestore Admin SDK bypasses Firestore Security Rules; actual IAM restrictions must be independently designed and verified. `allowCreateOnly` in a test object is a requirement, **not an IAM capability**.
- Existing `initialiseArchivedLegacyMode` remains an internal, disabled-by-default helper. Do not invoke it in production based on the evaluator result.
- One-time approval requires a trusted identity-verification channel, tamper-resistant approval record, atomic single-use consumption, a tightly scoped execution identity and independent audit.
- Production IAM, approval issuance, credential restriction and concurrency against real writers remain **unverified**.
- Never elevate the existing read-only verification service account.

## Future pre-execution blockers
1. Implement and independently review genuine operator and owner authentication, including anti-replay approval consumption.
2. Design a credentialed execution environment with externally enforced minimum privileges; verify actual effective IAM permissions.
3. Validate transaction behaviour against concurrent appointments/locks and Android writers, not just concurrent initializers.
4. Confirm a reviewed production-only command cannot be triggered from public endpoints or routine CI.
5. Repeat production read-only checks immediately before a separately authorised execution.
6. Obtain fresh, explicit user approval for that one narrowly specified production write.

No deployments, production Firebase reads or writes, deletion, freezing, migration, or public booking activation performed in this phase.

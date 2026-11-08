# Phase 10.38 — One-time production execution security review

**Decision: HOLD — NOT AUTHORIZED.** This review makes no production connections, writes or deployments.

## Reviewed
- `functions/controlledLegacyModeInitialization.js`: transaction-scoped checks and one-document create; disabled by default; archive owner path enforced.
- `functions/index.js`: initializer not exposed as a callable/HTTP export.
- `functions/bookingMode.js`: an older `initialiseLegacyMode(db,businessId)` helper exists and has **weaker checks**. It must NOT be used as a production shortcut; it does not validate the archive, shared appointments or booking locks.
- `functions/legacyModeInitializationPreflight.js`: read-only helper does not itself validate archive sourcePath; use the owner-bound `legacyProductionReadinessReview.js` instead.

## Remaining execution security gaps — block production until resolved
1. **Authorization:** `authenticatedUid`, `approval` and `executionEnabled` are parameters, not proof of user identity or a recorded owner approval. A trusted operator must independently verify the approver and capture an auditable, one-time authorization. Never expose an endpoint that allows callers to supply these values as authority.
2. **Credentials:** future execution must use a separate, time-limited, least-privilege writer identity with auditable access. Do not elevate `boustio-readonly-verifier` or reuse an owner's broad Cloud Shell credentials.
3. **Scope:** review Firestore permissions and ideally enforce one-document creation via a dedicated restricted execution mechanism. General Datastore User/Owner roles are too broad for this narrow operation.
4. **Transaction isolation:** ensure the production Firestore SDK/version supports all intended query reads in the transaction and confirm collection reads detect concurrent writes. Re-run emulator tests and concurrency/race tests before production use.
5. **Preflight freshness:** independently recheck archive owner path, schema, count, unique IDs, exact source hash, booking mode, migration marker, appointments and locks immediately before execution. Earlier REST results are not a permanent guarantee.
6. **Operational controls:** require a reviewed command/script with explicit production project confirmation, dry-run default, no production credentials in CI, logs with no customer data, operator identity and change record.
7. **Recovery:** document post-write verification, an incident response plan and any rollback preconditions. Do not automatically delete or overwrite mode if subsequent steps fail.
8. **Writer coordination:** confirm no pending Android uploads or concurrent legacy writes could invalidate assumptions. No freeze is approved.

## Automated non-production gate
Run `node --test functions/phase1038ExecutionSecurity.test.js`, or the manual GitHub Actions workflow **Boustio Phase 10.38 Execution Security Review**. This checks source-level invariants only, not cloud IAM, runtime permissions or a production deployment.

## Explicit exclusions
No production write, function deployment, freeze, deletion, migration or public booking enablement is approved or performed. Future execution requires separate explicit user authorization and closure of the gaps above.

# Boustio Phase 17 — production-readiness security audit

Date: 2026-11-18
Branch: `milestone-customer-booking-experience`
Scope: source review of Phase 17 public writer, trusted revision, service identity, recovery journal, transactional store and claim coordinator. **No live Firebase access, IAM change, deployment or customer-booking enablement.**

## Verdict: NOT APPROVED FOR PRODUCTION

All seven offline test suites passed in GitHub Actions run 44272142094. Those suites use fake databases and do not establish real Firestore concurrency, IAM isolation, cross-database behaviour, or production readiness.

## Blocking findings

### P17-A01 — CRITICAL — Same-version conflicting publication silently accepted
File: `functions/phase17PublicDatabaseWriter.js`
The condition `command.version===oldVersion` returns `ALREADY_APPLIED` without verifying operation, listing content or an immutable command digest. A conflicting publish/unpublish command with the same version can be misclassified as successful. **Fix:** store a canonical operation+UID+allowlisted-listing digest with each publication and return a conflict on unequal same-version commands. Test same-version different slug, name, and operation.

### P17-A02 — CRITICAL — Recovery is not fenced by worker ownership
Files: `functions/phase17DurableRecovery.js`, `functions/phase17RecoveryClaim.js`
`reconcile()` does not accept or validate a claim generation before `send()` or before journal completion. A worker whose lease expired can still issue an external request. The offline integrated test invokes the claim coordinator and recovery function separately, not as an enforced boundary. **Fix:** design an orchestrator with generation checks, transactional state transitions and downstream idempotency/fencing; prove expired workers cannot change publication state. Do not rely on a lease check alone for an external side effect.

### P17-A03 — HIGH — Journal transitions allow concurrent stale writers
File: `functions/phase17RecoveryFirestoreStore.js`
`put()` checks command identity and some state transitions, but not an expected revision/generation. Two reconcilers can overwrite each other's nonterminal journal updates. **Fix:** enforce compare-and-set journal generation and claim ownership within a single trusted transactional boundary. Test stale writes after a newer claim.

### P17-A04 — HIGH — Trusted timestamp revision loses valid precision
File: `functions/phase17TrustedRevision.js`
The microsecond integer representation rejects Firestore timestamps with nanoseconds not divisible by 1000. This fails closed but may reject valid updates and disrupt publication. **Fix:** use a full-precision, lexicographically sortable seconds/nanoseconds revision or a server-assigned monotonic revision, and migrate writer, journal and boundary together. Do not silently truncate.

### P17-A05 — HIGH — Server identity is not authorization for source freshness
Files: `functions/phase17ServiceIdentityBoundary.js`, `functions/phase17PublicWriterHandler.js`
The public writer verifies a specific service identity but accepts a caller-supplied numeric version and listing. It cannot independently verify that the command came from the latest private snapshot. **Fix:** restrict the private reader service to deriving immutable commands from verified owner/private snapshot state, protect the service's invocation path, and enforce replay/freshness controls. Service-account authentication alone does not prove freshness.

### P17-A06 — HIGH — Publication/recovery paths are not production integrated
Files: `functions/phase17PublicWriterHandler.js`, `functions/phase17RecoveryFirestoreStore.js`
The handler is not an exported production endpoint, and the recovery store has no approved live database wiring. The isolated public database, IAM restrictions and trusted private reader are not deployed. **Fix:** obtain separate approval for provisioning, IAM and deployment, then validate using emulator and staged integration tests before any real customer use.

### P17-A07 — MEDIUM — Recovery key and fingerprint design need hardening
File: `functions/phase17DurableRecovery.js`
The key is UID+operation+numeric version, and fingerprint uses `JSON.stringify` of profile object order. Identical logical listings with different key insertion order may conflict, while the key does not itself authenticate the command. **Fix:** canonical allowlisted payload encoding, stable digest, source revision and authenticated owner binding. Do not store private profile fields in journal.

### P17-A08 — MEDIUM — Transactional fake tests overstate production concurrency coverage
Files: `tests/phase17_end_to_end_recovery.test.js`, `tests/phase17_recovery_claim.test.js`
Fake transactions are serialized in-process and do not model Firestore retries, transaction conflicts, network partitions or independently scheduled workers. **Fix:** add Firebase emulator tests with independent clients, fault injection, crash/restart scenarios and Firestore security/IAM verification where possible.

## Required release gates

1. Resolve A01 and A02 first; add regression tests demonstrating previously unsafe behaviour.
2. Resolve A03–A05, including full-precision revision and source authenticity.
3. Verify allowlisted public projection, privacy, booking-disabled invariants, slug ownership, publish/unpublish and rollback across realistic concurrent conditions.
4. Add real Firestore emulator tests; audit Cloud Run authentication, IAM, Firestore database isolation and rules.
5. Prepare rollback, audit logging, budget and monitoring controls.
6. Request **separate explicit approval** before creating databases, changing IAM, reading/writing live Firebase data or deploying any service.
7. Keep customer bookings disabled until a distinct, approved launch process.

## Existing data protection

The audit only reads repository source and writes this Markdown report to the development branch. It does not access or modify existing appointments or live Firebase resources.

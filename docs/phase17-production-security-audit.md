# Boustio Phase 17 — final offline security audit (revision 2)

Date: 2026-11-18
Branch: `milestone-customer-booking-experience`
Basis: direct source inspection of the public writer, service boundary, handler, trusted revision, recovery journal, coordinator, claim store and previous audit. GitHub Actions run 44325230156 passed 16/16 offline suites. **No emulator, live Firebase, IAM or deployment testing was performed.**

## Decision: NOT APPROVED FOR PRODUCTION

The 16 passing offline suites demonstrate useful regression coverage, but do not prove real cross-process Firestore concurrency, authenticated freshness, IAM separation, production deployment or customer-booking safety.

## Finding register

### P17-A01 — Same-version digest: MITIGATED in isolated writer, NOT fully closed end-to-end
`phase17PublicDatabaseWriter.js` computes a SHA-256 digest over UID, operation, numeric version and sorted allowlisted listing fields. A conflicting same-version request returns `VERSION_CONFLICT`. The digest does **not** include `fullPrecisionRevision`, although current token validation requires exact correspondence with a microsecond-aligned numeric version. Any future migration permitting distinct submicrosecond revisions must update digest and key design together.

### P17-A02 — CRITICAL: Recovery claim and destination write are not atomically fenced
`phase17ClaimedRecovery.js` checks the claim before sending; `phase17ServiceIdentityBoundary.js` verifies it again before calling the public writer. However, a lease may expire or be superseded **between that verification and the public database transaction**. The destination fence records the greatest generation it has **seen**, not the current authoritative claim generation. Thus an expired worker can still be the first to reach the destination. Offline competing-worker tests do not cover this interleaving. Requires a production-safe protocol, authoritative fencing design and adversarial emulator/staging tests; do not claim expired workers can never publish.

### P17-A03 — HIGH: Recovery journal CAS is optional and not consistently enforced
`phase17RecoveryFirestoreStore.js` supports `expectedRevision`, but allows `put` without it. `phase17DurableRecovery.js` calls `store.put` without expected revisions, so concurrent reconcilers can overwrite nonterminal state. Require revision CAS and claim ownership in the production path, with explicit conflict handling and retry rules.

### P17-A04 — HIGH: Full-precision revision migration is incomplete
`phase17FullPrecisionRevision.js` preserves nanoseconds and `phase17TrustedRevision.js` can attach the token, but `versionFromSnapshot` rejects non-microsecond-aligned timestamps. `phase17PublicDatabaseWriter.js` still compares numeric versions and rejects submicrosecond precision. The `phase17ServiceIdentityBoundary.js` reconstructs a command containing only `uid`, `version`, `operation`, `profile`, **dropping `fullPrecisionRevision`** before the writer. The journal and claim key remain numeric. No full-precision end-to-end production path exists. Plan an atomic contract migration with mixed-version rules and rollback.

### P17-A05 — HIGH: Caller identity does not prove source ownership or freshness
`phase17ServiceIdentityBoundary.js` verifies a specific Google service account and re-projects public fields, but does not independently authenticate the profile snapshot, current ownership or freshness. A valid service identity could submit an outdated or invented but well-formed command. A trusted private-reader pipeline and replay/source-revision checks must be enforced and tested.

### P17-A06 — HIGH: Production architecture and isolation unverified
`phase17PublicWriterHandler.js` is not a deployed HTTP endpoint or Cloud Function. `phase17PublicDatabaseAdapter.js` only selects a named database through an injected SDK. There is no verified isolated database provisioning, IAM policy, live rules, protected endpoint or production claim store. Configuration flags are not evidence of enforced IAM isolation. Requires separate explicit approval before any cloud action.

### P17-A07 — MEDIUM/HIGH: Journal fingerprint and private-field protection incomplete
`phase17DurableRecovery.js` fingerprints `JSON.stringify` of the entire profile object; insertion order changes fingerprints. `phase17RecoveryFirestoreStore.js` checks `acceptingBookings` but does not allowlist journal profile fields. A caller could persist private profile fields. Replace with canonical allowlisted projection and reject unknown fields before storage. Validate command ownership and key equality rather than only `startsWith(uid+":")`.

### P17-A08 — HIGH: Tests are serialized fakes, not production concurrency evidence
`phase17_competing_workers.test.js` and other suites serialize transactions in one process. They do not simulate transaction retries, independently scheduled workers, network partitions, cross-database races, IAM denials or crash windows. Add independent-client Firebase emulator and fault-injection tests, then staged integration checks.

### P17-A09 — MEDIUM: Production handler does not support unpublish
`phase17ServiceIdentityBoundary.js` accepts only `publish`, while the writer supports `unpublish`. Production cancellation/unpublishing requires a separately authenticated, freshness-checked path with tests.

### P17-A10 — MEDIUM: Backward-compatible unsafe entry points remain
`applyPublicListingCommand` defaults to `requireFence:false`; `acceptTrustedPublication` defaults to `requireFence:false`; `reconcile` can send without a claim; `store.put` accepts writes without CAS. The assembled handler requires a claim, but other exports remain callable. Do not expose these entry points to production until guarded or explicitly isolated to tests.

## Release gates (all required before production approval)

1. Resolve A02, A03, A05 and A07 with fail-closed, source-authenticated, claim-aware recovery and journal writes.
2. Define and implement complete nanosecond revision contract across trusted reader, boundary, destination, journal, digest and fence keys; explicitly test legacy upgrade and rollback.
3. Implement authenticated publish **and** unpublish; verify privacy, slug ownership, disabled bookings and conflict handling.
4. Add realistic emulator concurrency, independent workers, crash/restart and network fault injection; test transaction retries and lease-expiry interleavings.
5. Audit Cloud Run/Functions endpoint auth, service-account IAM, database/rules isolation, monitoring, budgets and rollback plan.
6. Obtain separate explicit approval **before** database creation, IAM changes, any live Firebase reads/writes, deployment or migration.
7. Keep real customer bookings disabled until a separate approved launch process.

## Existing appointments and operational safety

This review only reads repository source and updates this Markdown document on the development branch. It does not access live Firebase, alter appointments, deploy services or enable customer bookings.

**Result: Phase 17 offline regression suite is green; Phase 17 production security remains blocked.**

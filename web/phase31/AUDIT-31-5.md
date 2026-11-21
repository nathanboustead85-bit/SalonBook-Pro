# Boustio Phase 31.5 — Business data integration foundation audit

## Scope reviewed
- `firestore.rules`: verified-owner-only private `users/{userId}/liveData/{dataType}` and `users/{userId}/business/profile`; published `publicBusinesses/{businessId}` individual get only; no public list or client write.
- `web/phase1239/catalogueAdapter.js`: existing public business profile is **profile-only**; services and staff do not become public automatically.
- `web/phase1280/catalogueContract.js`: validates an already-authorized published catalogue contract; does not create or fetch public catalogue data.
- Phase 31.1: isolated offline business snapshot contract.
- Phase 31.2: public-only, identity-matched, immutable service and staff display mapping.
- Phase 31.3: version, freshness and coherent-revision checks; no stale fallback.
- Phase 31.4: fail-closed unavailable state, explicit bounded retries, no raw error disclosure.

## Verified by the audit suite
Cross-phase compatibility, missing and unpublished data, owner/slug mismatch, invalid price and service publication, mixed revisions, future/expired snapshots, invalid recovery revisions, timeout retry exhaustion, data invalidation, immutable allowlisted output and non-disclosure of private contact and customer records.

## Security limitations and launch blockers
This is an **offline audit of contracts**, not an audit of a deployed Firebase service. The envelope's revision and timestamps are caller-provided, not cryptographically trusted. No production public catalogue publisher, authorized reader, authentication or server-enforced atomic revision protocol has been connected or verified. No real network, concurrency, emulator, cross-tenant Firebase permission or live booking test is claimed. Phase 31.1 staging fixtures are not the Firestore schema. Existing `publicBusinesses` records alone do not publish service and staff data.

**Decision: PASS for offline read-only foundation if CI is green; BLOCKED for production integration or live bookings.** Before live use, implement and emulator-test an owner-authorized public publication pipeline, atomic versioned snapshots, authorization and cross-business isolation, and secure read-only client integration. Obtain explicit approval before enabling any live feature or deployment.

No Android code, the two original Android appointments, Firestore rules, live bookings, payments, messaging or deployment are changed by Phase 31.5.

# Boustio Phase 11.2 — Production security and booking data architecture

**Design complete pending CI; production HOLD.** All code is design-only and is not exported from the deployed functions entrypoint.

## Trust boundary design
- **Customer web:** untrusted requests; authenticated or securely booking-scoped access, rate limits, anti-abuse, no privileged Firestore access.
- **Owner Android:** verified Firebase owner, least-privilege business operations; no audit, signing or migration override.
- **Booking service:** dedicated identity and service boundary; server-authoritative slot validation and transactional writes to a new demo-only booking model. Firestore Admin SDK bypasses rules, so production service separation and independently verified IAM/application enforcement are mandatory.
- **Approval issuer / consumer:** distinct principals and auditable scoped operations; no direct booking-source mutation.
- **Signing:** independently authorised operator using non-exportable managed keys with rotation and revocation.
- **Audit:** independently administered append-only/WORM event store with immutable retention, verification, alerting and safe crash reconciliation.
- **Deployment:** separate change-controlled identity; explicit human authorisation for any production write.

## Booking data protection and migration plan
1. Read-only inventory and digest verification of existing `users/{uid}/liveData/bookings` documents and backup archive.
2. Design reversible mapping into a new booking schema; test exclusively with synthetic emulator records.
3. Verify source counts, digests, staff/service mapping, time zones and idempotent import on emulator.
4. Rehearse rollback and restore, preserving original source and booking collections unchanged.
5. Obtain separate approval for any live migration, booking mode transition or production deployment. No migration, deletion, freezing or public booking activation is authorised.

## Production security blockers
- Privileged Admin SDK role separation is not deployed or IAM-verified.
- Independent immutable audit and cross-store crash-consistent receipt recovery are not implemented.
- Production KMS/HSM signing custody and rotation are not configured.
- Production monitoring, incident response, backups/restore rehearsal and independent security review remain outstanding.

## Phase 11.3 emulator-only booking API contract
`functions/phase113BookingContract.js` specifies a non-exported callable prototype `createDemoBooking` (not implemented or deployed). Required fields: `businessId`, `serviceId`, `staffId`, `startAt`, `idempotencyKey`, `customerAccessToken`. The server must verify customer identity or booking-scoped token, compute service duration and end time, validate working hours/breaks/closures and Europe/London DST, and allocate slots transactionally with replay-safe idempotency. Errors include invalid input, unauthorised access, unavailable slots and rate limiting.

**Next implementation step:** create the actual isolated Firestore/Auth emulator booking engine and concurrency tests, with synthetic demo data only. The contract is not a security control until server-side enforcement is implemented and tested.

## Safety and test gate
Ten static tests in `functions/phase112ArchitecturePolicy.test.js` verify the HOLD decision, protected paths, separation of trust boundaries, demo-only API contract, input shape, lack of exports and the disabled customer booking page. The existing 203-test Phase 10 suite is retained. Target after adding these tests: **213 tests**, subject to GitHub Actions verification.

No production Firebase modifications, function deployment, booking deletion/freezing or public booking activation.

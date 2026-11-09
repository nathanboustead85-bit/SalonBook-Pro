# Phase 11.2 — Production security and booking data architecture

**Decision: DESIGN ACCEPTED FOR EMULATOR DEVELOPMENT ONLY; PRODUCTION HOLD.**
Branch: `phase-9d4-teal-clients`. This phase makes no Firebase deployment, production write, booking mode transition or public-booking activation.

## Trust boundaries
1. **Browser customer**: untrusted. May request a quote and later submit an idempotent booking intent; must never supply trusted price, duration, lock state, owner ID or booking status. Customer identity/proof, abuse limits and consent remain to be designed and verified.
2. **Business Android owner**: verified Firebase Auth owner for management only. May not self-issue migration approvals, sign operator assertions or directly write protected cross-business collections.
3. **Booking API service**: proposed isolated runtime with narrowly defined operations; server resolves catalogue, staff hours, price, duration, time zone, closures, capacity and conflict state. No implementation or production service identity exists yet.
4. **Data store**: proposed new appointment records and per-staff slot locks created atomically; immutable-in-operation existing `users/{uid}/liveData/bookings` remains protected. Existing legacy booking sources must not be overwritten, migrated or frozen by these prototypes.
5. **Approval/cutover service**: Phase 10 emulator-only orchestrator. Its local filesystem audit is not WORM and its role separation is application-level; production approval remains denied.
6. **Independent audit/signing**: proposed separate administration, append-only storage, retention, KMS/HSM signing, verified IAM, alerting, dual-control recovery. None is configured.

## Data and concurrency contract
- Canonical business identifier comes from server-side catalogue and authenticated owner mapping, not arbitrary client paths.
- Server-authoritative availability: service duration, working hours, breaks, holidays, buffers, staff overlap, capacity and lead-time windows.
- Store appointment instants in UTC with the business IANA zone `Europe/London`; handle DST gaps and repeated local hours explicitly. Reject ambiguous or non-existent local-time requests.
- Use Firestore transactions for staff/time lock creation and booking creation, including a customer-scoped idempotency key and result record in the same transaction. Retrying the same request must return the same result; different customers must not share a key scope.
- Never rely on a client preview slot as an availability guarantee; recheck against authoritative state inside the transaction.
- Cancellation and rescheduling require scoped customer proof or verified owner identity, audit event, atomic release/replacement of locks and defined notice periods.
- No raw payment-card details. Default flow is reserve online, pay in salon. Payment provider integration is a later separately approved phase.
- Personal data: minimise, encrypt in transit, enforce access separation, define retention/export/deletion and subject-access processes before any pilot.

## Crash and rollback safety
- No production write or cutover permitted until a read-only inventory and independent backup verification establish source integrity and restoration.
- Proposed rollout must use separate staging Firebase project, feature flags default off, canary business consent, metrics and explicit rollback criteria.
- Rollback must disable *new* booking writes without destroying previously confirmed bookings or orphaning lock records. Define a reconciliation plan before enabling live traffic.
- Audit writes must be independently durable and fail closed. Phase 10 Firestore-to-filesystem crash window is unresolved.

## Phase 11.3 API draft
`functions/phase113BookingEngineContract.js` is a **non-deployed design validator**, not a booking processor. It defines:
- `quoteAvailability`: `businessId, serviceId, staffId, localDate`.
- `createBooking`: `businessId, serviceId, staffId, startAt, customerRef, idempotencyKey`.
- `cancelBooking`: `businessId, bookingId, customerProof, idempotencyKey`.
- `rescheduleBooking`: `businessId, bookingId, newStartAt, customerProof, idempotencyKey`.

The draft only validates allowed field names and basic shapes. It does **not** authenticate users, validate signed customer proofs, verify calendar dates semantically, enforce rates, compute availability, prevent overlaps or write data. All must be implemented and tested in Phase 11.3. No live endpoints exist.

## Gates to progress
1. Pass Phase 11.2 non-destructive static tests and the existing Phase 10 security regression suite.
2. Design and implement emulator-only transactions for create/cancel/reschedule with synthetic bookings, concurrent request tests, retry/idempotency tests, ownership checks, DST and booking preservation tests.
3. Review actual IAM scope and independent audit/key custody architecture before any production implementation.
4. Keep `functions/index.js`, Firebase project settings, production bookings and public booking flags untouched.

**No production authorisation is implied by passing tests.**

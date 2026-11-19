# Boustio Phase 26.4 — Callable runtime authorization and abuse-prevention audit

## Execution method
Runs the **actual exported callable handlers** from `functions/index.js` using isolated in-memory Firebase Admin and HTTPS callable doubles. Tests run without network, cloud credentials, Firebase deployments or Firestore writes. This complements the Phase 26.2–26.3 Firestore emulator checks.

## Test coverage
- Anonymous and unverified requests are rejected by owner-only publishing, unpublishing, catalogue, chat reply and migration inspection callables.
- Forged ownership in the private profile is rejected; user-supplied target business IDs cannot redirect publication or unpublication to another business.
- Existing slug reservations and conflicting public slug mappings reject publication without committing writes.
- Missing profile and invalid slug are rejected.
- Successful synthetic publication keeps `acceptingBookings: false`; unpublishing disables publication and bookings.
- Catalogue publishing refuses arbitrary client-supplied catalogue payloads.
- Business and guest chat endpoints reject requests while `BOUSTIO_CHAT_ENABLED` is false; non-anonymous guest identity is rejected.
- Denied operations are checked for absence of committed synthetic writes.

## Security risks and remaining work
- Existing callable exports have `enforceAppCheck: false`. Enabling live functions requires a separate, approved App Check, abuse-prevention and rate-limit plan.
- This harness directly invokes handler callbacks with mocks. It is **not** an end-to-end HTTP protocol, real Firebase Auth token verification, Firebase Functions emulator, production IAM or deployed configuration test.
- More positive-path and adversarial tests are needed for customer chat rate limits, repeated guest sessions, chat ownership, and public HTTP endpoints.
- Existing publishing exports may be deployed; this milestone does not alter their production state.
- No live bookings, subscriptions, payments, publishing or messaging are enabled or deployed. No real appointments are accessed.

Next: review findings, then consider Phase 26.5 full callable emulator and abuse-rate-limit testing before launch approval.

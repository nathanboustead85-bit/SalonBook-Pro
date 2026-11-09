# Phase 11.4 — UK scheduling and verified customer prototype

**Emulator-only; production HOLD.** No deployed function exports, Firebase production writes, migration, booking freeze or public booking activation.

## Implementation
- `functions/phase114UkSchedule.js`: Europe/London wall-clock conversion using Node Intl; validates staff weekly working intervals, break intervals, staff holidays and business closure dates. Rejects appointments crossing a local calendar day and intervals crossing spring-forward or autumn-fold DST transitions. Bookings are submitted as unambiguous UTC timestamps.
- `createVerifiedCustomer({auth})`: accepts a trusted Firebase Admin Auth emulator dependency, validates Firebase ID token with revocation checking and requires `email_verified`. This is an adapter; it is not a public endpoint.
- `functions/phase113DemoBookingEngine.js`: accepts optional trusted `scheduleValidator`; enforces schedule inside the Firestore transaction before writing the synthetic booking. Existing Phase 11.3 UTC demo behaviour remains for backward-compatible tests.

## Test plan
18 emulator integration tests cover winter GMT, summer BST, out-of-hours, breaks, adjacent appointments, staff holidays, business closures, weekends, DST spring-forward and autumn-fold, local date changes, invalid schedule data, transactional enforcement, invalid Auth tokens and an Auth-emulator-generated verified ID token.

## Explicit limitations
- This rejects all appointments that span a DST transition; future work may support them with explicit offset/disambiguation policy.
- No rate limiting, holiday calendar sync, cancellation, rescheduling, booking buffers, production IAM enforcement, public website integration or Android calendar integration.
- The demo engine still accepts a trusted callback verifier for older tests. New `createVerifiedCustomer` must be explicitly wired in trusted emulator setup; no customer identity system is deployed.
- Production requires independent security review and explicit authorisation.

The existing 237 verified tests plus 18 new tests yield a **255-test target**, subject to GitHub Actions verification.

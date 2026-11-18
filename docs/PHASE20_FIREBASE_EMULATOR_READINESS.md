# Boustio Phase 20.1 — Firebase Emulator Integration Readiness

**Release decision: NO-GO. Emulator-only testing; no production rollout.**

## Implemented
- Separate GitHub Actions workflow using Node 22, Java 21 and Firebase CLI in an isolated `demo-boustio-phase20` project.
- Auth emulator test: synthetic email/password account creation, login, and confirmation that a newly created account is **not email verified**.
- Firestore emulator rules tests: verified-owner private profile access, unverified/anonymous/cross-owner denials, safe owner profile write, forbidden booking activation, deletion denial.
- Negative rules tests for onboarding drafts/completion, customer booking requests/reservations and booking locks.
- Tests use emulator-only local hosts, synthetic accounts and no production credentials.

## Important scope distinction
The Firestore tests use **synthetic auth claims** supplied by Firebase rules-unit-testing. They verify how Firestore rules respond to verified and unverified claims; they do **not** prove end-to-end propagation of verified Firebase Auth emulator ID tokens to Firestore. The Auth test independently checks real emulator sign-up and login. Full verified-email lifecycle and real ID-token Firestore integration remain future work.

## Remaining blockers
- Confirm GitHub Actions emulator workflow succeeds and address any failures.
- Test actual Auth emulator verified-email changes and token refresh/revocation with Firestore SDK.
- Exercise all sensitive Firestore paths and operations, including backups, legacy liveData, clients, conversations and public catalogue.
- Add transactional multi-device conflict and concurrency tests against emulator data.
- Review production IAM, Firebase rules deployment, billing, audit logs, account recovery, rate limits and operational rollback.
- Reconcile original Android bookings before enabling any customer booking path.
- Complete staged browser/Samsung verification and separate explicit production approval.

**Safety:** public registration disabled; customer bookings disabled; no deployment; no changes to the original Android appointments.

# Boustio Phase 41.1 — Isolated staging integration architecture and security readiness

## Source-grounded architecture
- Phase 39 `integration-contract-39-1.js` injects Firestore `db`, `doc`, `runTransaction`, credentials and clock. `unified-session-39-2.js` uses an injected auth object and forced token refresh; neither initializes the production SDK.
- Phase 40 `browser-dashboard-40-2.js` requires injected `onAuthStateChanged` and view-model. `secure-recovery-40-4.js` requires an externally trusted revocation verifier, **not implemented here**.
- Phase 40.3 hours/revision validation is a proposed v2 schema only; Android v1 documents do not provide verified business-wide hours or shared revisions.
- Phase 40.5's five P0 blockers remain OPEN. No staging acceptance has been signed off.

## Staging environment separation
Phase 41.1 defines an explicit `EMULATOR_ONLY` architecture contract with project ID `demo-boustio-*`, loopback-only Firestore/Auth endpoints, and all network/write/deploy permissions set false. These flags are contract validation inputs, **not** a network firewall or an SDK-level enforcement mechanism. No staging project is created or connected. CI uses Firebase emulators and synthetic data; test fixture seeding is confined to emulator rules-disabled context.

## Firebase SDK integration contract
An injected adapter must expose `auth.currentUser`, `onAuthStateChanged`, `doc` and `runTransaction`. The contract intentionally does not instantiate Firebase, accept write functions, embed credentials or expose a public route. Runtime security still requires separately audited token revocation and Firestore rules.

## P0 security blocker tracking
- 40.5-P0-01 OPEN: trusted revocation, real staging SDK and App Check
- 40.5-P0-02 OPEN: verified business hours and atomic cross-device revisions
- 40.5-P0-03 OPEN: approved appointment backup/migration/rollback plan
- 40.5-P0-04 OPEN: Samsung real-device accessibility and account-switch acceptance
- 40.5-P0-05 OPEN: privacy, operations, independent security and deployment approval

## Future acceptance gates (not performed)
1. Explicit approval for a separate nonproduction staging project and credential isolation.
2. Independent Firebase rules, App Check, revocation and SDK review.
3. Real-device multi-account, offline, screen reader and accessibility testing.
4. Dry-run synthetic migration/rollback evidence and explicit approval before any Android data migration.
5. Privacy/operations/release review; explicit approval before live bookings, payments, messaging or deployment.

**Verdict:** architecture contracts only, staging not connected or approved, production not ready. Two original Android appointments remain untouched. No production Firebase reads, writes, rules updates or deployment.

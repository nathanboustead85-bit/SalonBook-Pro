# Boustio Phase 39.1 — Isolated dashboard integration preparation and gap assessment

## Scope and evidence
Reviewed actual source files:
- `web/phase36/android-business-adapter-36-1.js`: injected read-only Firestore transaction reads profile/services/staff; no Firebase initialization.
- `web/phase37/session-guard-37-4.js`: separate browser session guard with auth token refresh and UI view projection; not yet connected to the Phase 38 recovery module.
- `web/phase38/owner-authorization-38-3.js`: verified-owner, expiry and atomic read checks.
- `web/phase38/dashboard-recovery-38-4.js`: generation-fenced refresh, bounded retries and private-data clearing.
- `web/phase38/README-38-5.md`: release blockers and explicit non-launch verdict.

New `integration-contract-39-1.js` composes the existing reader, owner gate and recovery coordinator **only when explicitly instantiated with injected dependencies**. It does not initialize Firebase, mount a browser UI, add public routes or change production configuration. The Phase 37 session guard is not silently combined because it uses a distinct view contract and needs a separately tested adapter.

## Prioritized implementation plan

| Order | Priority | Gap / next implementation | Acceptance evidence |
| --- | --- | --- | --- |
| 39.2 | P0 | Define one browser auth/session identity lifecycle contract between Phase 37 and Phase 38, including token refresh, revocation strategy and sign-out race handling | Isolated unit tests for identity switches, revoked/expired tokens and asynchronous UI clearing |
| 39.3 | P0 | Build read-only dashboard view-model adapter with explicit unavailable/loading/ready states and no private-data flash | Synthetic component tests, malicious record regression and accessibility checks |
| 39.4 | P0 | Validate Android v1 schema mappings and missing shared revision/working-hours semantics; fail closed for unsupported records | Emulator tests, no production reads, documented migration decision |
| 39.5 | P0 | Audit full integrated isolated dashboard with cross-owner, network and concurrent request tests | Emulator + browser regression; explicit launch blockers retained |
| Later | P0 | Independently review production Firebase authorization, token revocation, App Check, deployment and rollback plans | Explicit separate production approval; not cleared by Phase 39 |
| Later | P1 | Nonproduction Samsung browser, onboarding, accessibility, multi-device and operational testing | Human sign-off with synthetic/staging data |
| Later | P2 | Live booking, payments, messaging, tipping, deployment | Not in Phase 39.1; remain disabled |

## Non-negotiable gates
No production Firestore reads or writes, no changes to deployed rules, no release/deploy, no live bookings/payments/messaging. The two original Android appointments are not accessed. Passing the isolated CI does not mean the actual browser dashboard has been integrated or launched.

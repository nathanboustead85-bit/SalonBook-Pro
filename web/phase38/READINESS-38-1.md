# Boustio Phase 38.1 — Business dashboard integration and production-readiness gap assessment

**Decision: NOT READY FOR PRODUCTION.** This is a source-based gap assessment and isolated verification plan, not deployment approval. Phase 37.5 GitHub Actions run [45006376036](https://github.com/nathanboustead85-bit/SalonBook-Pro/actions/runs/45006376036) passed 61 automated tests (7 audit, 9 guard, 3 reactive, 12 DOM, 13 Chromium, 17 emulator). Passing isolated tests does not demonstrate real-world readiness.

## Verified integration inventory (source-inspected)
| Component | Existing source | Confirmed scope | Remaining gap |
|---|---|---|---|
| Business read adapter | `web/phase36/android-business-adapter-36-1.js` | Dependency-injected atomic reads of owner profile, services and staff | Real schema migrations, production read-only validation and performance not verified |
| Session projection | `web/phase36/secure-dashboard-session-36-4.js` | Read-only view projection; booking/edit/message/payment flags false | Complete business dashboard feature parity and role permissions |
| Audit facade | `web/phase36/final-integration-audit-36-5.js` | Rejects privileged flags and private data in unavailable states | Independent penetration/security review |
| Browser entry | `web/phase37/dashboard-37-2-entry.js` | Loopback-only Firebase emulators; guarded reactive auth and read-only renderer | Safe production configuration strategy; deployment prohibited |
| Session guard | `web/phase37/session-guard-37-4.js` | Token verification, owner changes, network loss, stale async response suppression | Real revocation, multi-device behaviour, background/foreground testing |
| Prior audit | `web/phase37/READINESS-37-5.md` | Explicit production launch blockers | No blockers cleared by this assessment |

## Prioritised implementation plan
**P0 — Must precede any live customer or business access**
1. **38.2: Isolated schema compatibility and data integrity:** compare Android profile/services/staff fields with browser mapping; versioning, missing fields, malformed records and migration tests. Never migrate real appointments.
2. **38.3: Owner isolation and authorization:** emulator multi-owner/role/verified-owner denial matrix, token expiry/revocation and App Check design; independent rules review before any publication.
3. **38.4: Safe dashboard recovery:** concurrency, stale reads, network interruption, retry limits, multi-tab sign-out, page lifecycle and accessibility; keep read-only.
4. **38.5: Release gates and threat model:** security evidence, privacy/retention, rate limits, cost budgets, monitoring and rollback plan. Explicit human approval required for each production action.

**P1 — Before business beta**
5. Business onboarding and owner-only editing design; permission-gated emulator write tests with explicit rollback and no live activation.
6. Cross-device Android/browser sync validation with synthetic data only; no device appointments touched.
7. Business dashboard UX parity: services, staff, hours, business profile, gallery/portfolio, empty/error states and mobile usability.

**P2 — Before public launch (separate explicit authorisations)**
8. Live booking concurrency/idempotency and cancellation/rescheduling audit; payment provider, refunds and reconciliation; messaging/attachments/abuse protection; App Check enforcement and production Firestore rules validation.
9. Public hosting/domain, monitoring, support, backups, data protection and gradual rollout plan. No deployment in Phase 38.1.

## Phase 38.1 acceptance gate
- Source-grounded gap inventory and ordered P0/P1/P2 roadmap committed.
- Automated checks confirm the assessed files exist, emulator-only browser config, no live-feature flags or deployment workflow commands, and no writes in the read adapter.
- Existing isolated Phase 37.5 security suites and Firebase emulator/Chromium regression rerun.
- Green GitHub Actions run is required; do not call this phase complete until verified.
- **No deployment:** production Firestore, Android device data, two original appointments, real bookings, payments and messaging are excluded.

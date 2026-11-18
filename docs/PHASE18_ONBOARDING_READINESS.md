# Boustio Phase 18 — Business Onboarding Release Readiness

**Decision: NO-GO for public registration, real account onboarding, dashboard persistence, and customer bookings.**

**Scope:** Phase 18.1–18.10 development foundations on `milestone-customer-booking-experience`. This document is a source-code and offline automated-test audit, **not** a production security certification. GitHub Actions results must be checked separately after the final commit.

## What has been built (offline foundations)

| Area | Current implementation | Live status |
| --- | --- | --- |
| Business registration | Teal-and-white preview, validation, inert Firebase Auth adapter | Disabled |
| Verified owner | UID/email verification guards; private profile builder | Creation disabled |
| Business setup | Five-step wizard, services, staff, weekly hours, review | Preview only |
| Save and resume | Owner-specific draft envelope, schema/progress checks, recovery | Read/write disabled |
| Completion | Verified owner, full-step validation, duplicate service/staff guards | Completion disabled |
| Dashboard | Overview, progress, profile, services, staff, hours, booking status | Demo only |
| Dashboard management | In-memory add/edit/remove, validation, discard and unsaved warning | No persistence |
| Customer booking | Disabled; no public booking activation in Phase 18 | Disabled |

## Security controls confirmed in source

1. Public registration, profile creation, save/resume, onboarding completion, dashboard writes and customer bookings have explicit disabled gates.
2. Onboarding draft and completion marker paths derive from verified owner UID, not submitted owner IDs. Recovery rejects cross-owner and malformed envelopes.
3. Firestore client access to `users/{userId}/onboardingDrafts/{draftId}` and `users/{userId}/onboardingCompletion/{completionId}` is explicitly denied. Rules have **not** been deployed as part of this phase.
4. The profile builder overrides caller-supplied identity and booking status; preview pages use text-safe rendering and no browser persistence.
5. Completion duplicate checking is only a pure offline guard; it does **not** provide race-safe uniqueness without a trusted transactional backend.
6. Existing Android appointment records were not accessed, migrated, or modified by these Phase 18 commits.

## Release blockers — must be resolved before any launch

1. **Verified real registration:** production-safe Firebase Auth wiring, verification refresh, abuse/rate limits, session handling and recovery.
2. **Owner-scoped persistence:** explicit Firestore rules design, Firebase emulator tests for positive and negative cases, field validation, cross-owner denial, data migration and rollback.
3. **Atomic completion:** trusted server-side transaction with create-only marker, replay/idempotency tests, concurrent requests and verified-owner authorization.
4. **Dashboard integration:** real owner-scoped reads/writes, concurrency/version conflict detection, deletion confirmation, audit logs and recovery.
5. **Legacy Android bookings:** migration and shared conflict-lock reconciliation before any customer booking activation, preserving existing appointments.
6. **Publishing and booking:** trusted server-side catalogue/staff availability, booking conflict tests, separate booking enablement review, staged rollout and manual approval.
7. **Operational readiness:** privacy/retention policy, monitoring, billing controls, security review, DNS/hosting/deployment permissions, staging tests and rollback drills.
8. **End-to-end device/browser checks:** Samsung/mobile UI, accessibility, real verified-user flows, failure/restart scenarios and independent security review.

## Required release sequence

- Keep all feature gates **false** and do not deploy.
- Run the Phase 18 GitHub Actions offline suite; inspect the final run outcome.
- Design the trusted backend and Firestore rules; verify in Firebase emulators and staging.
- Perform authenticated end-to-end tests, concurrency tests, legacy appointment safety checks and rollback exercises.
- Request explicit approval separately for any production deployment, registration enablement or customer booking activation.

**Current conclusion:** Phase 18 offline foundation work may be considered implemented once its final GitHub Actions suite passes. **This does not mean live business registration or bookings are ready. No deployment has been performed.**

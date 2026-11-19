# Boustio Phase 21.5 — Isolated staging deployment safety

**Release verdict: NO-GO. No deployment is authorized or performed.** This phase creates a static fail-closed release manifest and read-only CI checks, not an executable staging deployment workflow.

## Approval gates (all currently unapproved)
1. Obtain explicit **manual approval** for a separate Firebase project and protected staging environment. Confirm its project ID differs from production; the manifest intentionally contains no target project or hostname.
2. Require a separate human reviewer and protected environment approvals before adding credentials or any deployment capability. Do not use production credentials in staging.
3. Independently review Auth, Firestore rules, cross-owner access, browser offline handling, account revocation and booking conflict controls.
4. Validate staging access restrictions, no-index policy, audit logging, budget alerts and a strict synthetic-only data policy.
5. Keep public registration, customer bookings and live dashboard disabled in UI and backend; no real customers or appointment records may be seeded.
6. Verify the two original Samsung appointments independently before any eventual launch.

## Rollback plan (not yet validated)
- Capture a versioned staging build artifact and immutable release identifier before future deployment.
- Record staging configuration, Firestore rules version, hosting release ID and feature flags in a reviewable change log.
- Back up **staging-only** data before a future approved migration; verify backup integrity and access controls.
- Run a staging restore drill with synthetic records, confirm prior version can be restored, and document maximum recovery time.
- On any failed health/security check: disable staging traffic, restore the last known-good staging release, verify sign-in and data isolation, and open an incident review.
- Never roll back production or overwrite Android appointments as part of staging recovery.

## Automated enforcement
The `config/phase21-staging-release-gates.json` manifest denies deployment and all feature activations. The Phase 21.5 GitHub Actions workflow is read-only, uses no secrets, and runs six static safety tests. **It has no deploy command and cannot release staging.** Approval gates are a documented specification, not configured GitHub Environment protection rules; those must be established separately with explicit permission.

## Remaining blockers
Real physical-device testing, automatic offline controller integration, production-equivalent rules review, independent staging Firebase project setup, staging budget alerts, staging credentials, backup/restore drill and protected GitHub Environment approvals remain outstanding.

**Decision:** Phase 21.5 can pass its static safety tests without being deployable or launch-ready. Public registration and customer bookings remain disabled. No production Firebase configuration, existing Android appointments or live booking data are modified.

# Phase 52.1 — Independent staging security verification handover

Status: **NOT APPROVED — evidence collection only**. Scope: `boustio-staging`. Draft PR #5 remains unmerged.

## Independent reviewer tasks

1. **G1 IAM and staging isolation**: obtain read-only IAM policy and effective inherited grants; examine service-account Token Creator bindings (member, resource scope and conditions), user-managed keys, workload identity, and regional backend inventory. Review whether each privileged role is necessary. Do not remove Google-managed roles speculatively.
2. **G2 Authentication**: plan synthetic-account staging tests for email verification, revoked/expired tokens, sessions and owner separation. Never test with real customers.
3. **G3 Firestore**: capture deployed ruleset revision, then obtain independently observed negative client-SDK read/write tests with synthetic accounts. Playground screenshots and fixture emulator tests alone are insufficient.
4. **G4 App Check**: document test-only web attestation, enforcement OFF and approved production attestation plan.
5. **G5 Booking safety**: review independently witnessed concurrency, idempotency, retries, conflict and failure recovery.
6. **G6 Messaging/payments**: confirm disabled state; review attachment, abuse, quota and payment controls before any enablement.
7. **G7 Operational readiness**: inspect secret-scanning, audit logs, billing alerts, rollback, deployment approvals and release authority.

## Evidence rules

Every gate needs reviewer name, date, project ID, commit SHA, relevant Actions run URL, redacted evidence link, expected/actual outcomes, finding severity and explicit decision. Screenshots alone cannot prove effective permissions or deployed revision. Missing or unverifiable evidence is **OPEN**, never implicitly passed.

## Existing observations, not independent proof

See `phase-51-final-evidence-assessment-2026-11-23.md`. IAM screenshots show a human Owner (Legacy), Firebase Admin SDK principal with Token Creator, and recognizable Google/Firebase service agents. User reported no keys; the full IAM policy and key inventory were not independently exported. Cloud Run screens showed no services/jobs; Firebase Functions showed an upgrade prompt. Firestore rules editor showed deny-all; Playground simulated reads were denied. None of these facts authorizes deployment.

## Hard stops

All **seven launch blockers remain OPEN**. No live bookings, payments, messaging, deployment, App Check enforcement, Firebase rules publishing, IAM changes, billing upgrades or PR merge. Preserve the two original Android appointments; do not access or restore their data. Independent reviewer sign-off and a separately authorized release decision are mandatory.

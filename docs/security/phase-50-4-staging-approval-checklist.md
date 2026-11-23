# Phase 50.4 — staging creation approval package

**Planning only; no staging project is created, no credentials are provisioned and no real staging tests are authorized.**

## What the repository actually establishes
The Android configuration at `app/google-services.json` identifies the existing Android-connected Firebase project `salonbook-pro-ad5ff`. Do not reuse it for staging. Its environment classification is not independently established.

## Owner approval decision checklist
- [ ] Owner explicitly authorizes a **new, separate** Firebase/GCP project, including its intended name and budget.
- [ ] Owner reviews Firebase Console project selection and verifies the new project is distinct from `salonbook-pro-ad5ff`.
- [ ] Owner understands Firebase/GCP budgets are **alerts, not hard spending caps**.
- [ ] Independent reviewer is assigned to approve least-privilege IAM, service-account separation and secret handling.
- [ ] Review isolated Auth, Firestore, Storage, Functions, hosting, domains, App Check and logs, with **synthetic users and data only**.
- [ ] Review billing alerts, quotas, monitoring, abuse protection and rollback plan.
- [ ] Obtain **separate** authorization before credentials, real staging tests or deployment. Never use the existing Android accounts, bookings or production data.

## Approval boundary
Saying 'Go' to Phase 50.4 approves only the creation of this checklist and offline automated checks. It does not approve cloud project creation, grant IAM, authorize Firebase access or close any launch blocker. Approval should be recorded explicitly after the owner reviews the above and chooses a project ID. The independent reviewer must verify actual cloud isolation; passing offline CI is not sufficient.

Seven launch blockers remain OPEN. Live bookings, payments, messaging and deployment remain disabled. Preserve the two original Android appointments.

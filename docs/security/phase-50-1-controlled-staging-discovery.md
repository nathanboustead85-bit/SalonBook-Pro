# Phase 50.1 — controlled staging environment discovery

**DISCOVERY ONLY. No staging project has been created or verified, no Firebase credentials used, and no real staging tests authorized.**

## Actual repository observations
On the existing Phase 49 branch, attempts to fetch the exact paths `firebase.json`, `.firebaserc` and `functions/package.json` returned NOT_FOUND. This does **not** prove Firebase is absent: configuration could live in a subdirectory or elsewhere. Do not assume the existing Firebase project is safe for staging or use production credentials.

## Before any real staging work
1. Identify the repository's actual Firebase configuration and confirm existing project IDs through approved read-only review. Never paste credentials or private keys into GitHub.
2. Obtain explicit owner approval for a **separate non-production Firebase staging project**. Do not repurpose the live project.
3. Assign an independent security reviewer and define least-privilege IAM, time-limited access, secret boundaries and credential rotation.
4. Confirm distinct Auth, Firestore, Storage, Functions, service accounts, domains, data and logs, with synthetic users only. Confirm billing budgets and monitoring; budgets are alerts, not hard spending caps.
5. Obtain explicit authorization for each real staging test. Verify negative cases, backend owner isolation, Firebase Admin revocation and rollback under the independently reviewed Phase 49 plan.
6. Keep all seven launch blockers OPEN. Independent verification and formal approval must occur separately from GitHub Actions.

## Scope and safety
This phase only creates a machine-readable inventory, documentation and offline tests. No Firebase CLI login, Admin SDK, staging creation, production writes, Android APK changes, release, payments, messaging, live bookings or deployment. Preserve the two original Android appointments.

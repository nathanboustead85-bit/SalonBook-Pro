# Phase 50.2 — actual Firebase configuration discovery and isolated staging plan

**Read-only source inspection only. No staging project created, no Firebase API call, no production access or deployment.**

## Verified repository findings
- `app/google-services.json` exists and declares Android Firebase project `salonbook-pro-ad5ff`. Treat this as an **existing Android-connected project**, never as an automatically approved staging project. The presence of this client configuration does not establish whether the project is production or staging.
- `app/build.gradle.kts` applies Google Services and includes Firebase Auth and Firestore dependencies.
- `.github/workflows/boustio-phase-176-wif-stages.yml` contains a separately gated read-only identity federation diagnostic. Its existence does not prove that a separate staging Firebase environment exists.
- Earlier Phase 50.1 checks did not find root `firebase.json`, `.firebaserc` or `functions/package.json` at those exact paths; those findings do not mean Firebase is absent.

## Required next decision — not automatically executed
The owner must explicitly approve the creation or use of a **distinct, isolated Firebase staging project**, confirm project identifiers via trusted Firebase Console review, and approve the scope of any real tests. Assign an independent reviewer. Verify IAM, separate Auth/Firestore/Storage, secrets, data, billing alerts, and rollback before provisioning any credentials. Budgets provide alerts, not hard caps.

Do not point staging tests at `salonbook-pro-ad5ff` without independent proof of environment classification and separate authorization. Avoid changing `app/google-services.json`, Android application ID, existing accounts or appointments. The two original Android appointments must remain untouched.

## Phase 50.2 outcome
This phase confirms actual Firebase source configuration and identifies the **missing staging isolation approval**. It does not authorize real staging, close any of the seven launch blockers, or enable live bookings, payments, messaging or deployment.

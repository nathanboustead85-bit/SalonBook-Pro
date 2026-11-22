# Boustio Phase 50.3 — isolated Firebase staging design

**Status: DESIGN ONLY.** No staging environment exists or is verified by this change. No credentials, Firebase API calls, Android changes or deployment.

## Confirmed starting point
The checked-in Android client `app/google-services.json` identifies `salonbook-pro-ad5ff`. This is an existing Android-connected project and is forbidden as a staging candidate in the Phase 50.3 guard. Its production classification has not been independently verified.

## Proposed isolation architecture
A separately owned Firebase/GCP project must be reviewed and approved before creation or use. It needs dedicated Auth tenants/users, Firestore databases/rules, Storage buckets/rules, Functions service accounts, IAM, App Check configuration, secrets, monitoring and billing alerts. Use synthetic data only, with no imports from the existing Android project. Do not share service-account credentials, GitHub environments or project aliases. Record the approved staging project ID only after independent review and explicit owner authorization.

The candidate checker validates **only** ID format, separation from the known Android project and design-stage data/access restrictions. Passing it is **not** approval, cloud isolation verification or permission to run tests.

## Required approvals before implementation
1. Owner approval for a distinct Firebase staging project and budget.
2. Independent reviewer assignment and review of IAM and isolation design.
3. Confirm project identity and actual Firebase resource isolation in the Console.
4. Separate authorization for credential provisioning, synthetic staging tests and rollback drills.

All seven launch blockers remain OPEN. Live bookings, payments, messaging and deployment remain disabled. Preserve the two original Android appointments without reading, writing or migrating them.

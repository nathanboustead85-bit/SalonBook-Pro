# Boustio Phase 17 — Business Publisher runtime permission review

## Confirmed implementation
- The new runtime service account was created in Google Cloud by the owner:
  `boustio-business-publisher@salonbook-pro-ad5ff.iam.gserviceaccount.com`.
- `functions/index.js` pins only `publishBusiness` to that runtime identity.
- No runtime permissions, impersonation grants, function deployment, Firestore writes, or booking activation are authorised by this document.

## Firestore operations used by publishBusiness
The callable requires an authenticated, verified Firebase user and reads the caller's private profile at `users/{uid}/business/profile`. Its transaction reads and writes `publicBusinesses/{uid}`, `businessSlugs/{slug}`, and `publicSlugMappings/{slug}`, including previous slug mappings when renaming. It may delete the prior slug and mapping. It sets `acceptingBookings: false`.

## IAM design decision needed before deployment
Firebase Admin SDK Firestore requests use the runtime service account and IAM, not the Firebase client Firestore security rules. The common Cloud Datastore User role (`roles/datastore.user`) is **not** collection-scoped and can allow access to documents beyond those four paths. Do not describe it as least-privilege per collection. Review database-level IAM scoping or an alternative backend architecture and the risks before granting runtime data access. No IAM grant is performed by this source change.

For deployment, `boustio-function-deployer@salonbook-pro-ad5ff.iam.gserviceaccount.com` would need `roles/iam.serviceAccountUser` on the *specific* publisher runtime service account, in addition to reviewed deployment/build permissions. Never grant Service Account Admin for this purpose. The new runtime account itself must not be granted Cloud Functions Developer.

## Remaining safeguards
- Keep real customer bookings disabled and preserve the two original Android appointments.
- Only deploy `functions:publishBusiness` after separate explicit owner authorisation and a protected, reviewed deployment workflow.
- Never deploy all functions, invoke publishBusiness, or change live Firestore as part of IAM testing.
- Validate actual Cloud Functions and Cloud Run access separately; GitHub Actions success is not proof of IAM deploy rights.

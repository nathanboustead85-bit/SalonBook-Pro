# Boustio publishBusiness — deployment decision record (17 November 2026)

## Verified from repository and GitHub Actions

- Authentication is fixed: run 44129301676 succeeded in obtaining an impersonated Google Cloud access token for `boustio-function-deployer@salonbook-pro-ad5ff.iam.gserviceaccount.com`.
- Read-only metadata diagnostic run 44130150620 completed: Cloud Functions v2 returned `RESOURCE_NOT_FOUND_OR_NOT_VISIBLE`; Cloud Run returned `OTHER_ERROR`. **Neither result proves that the function is absent, or that deployment permissions are sufficient.**
- `functions/index.js` exports a Gen 2 callable `publishBusiness` in `europe-west2`; `firebase.json` selects Node.js 22 and the `functions` source directory.
- Publishing requires verified owner identity, validates the business profile, checks slug ownership and writes the public profile and slug mapping transactionally. Its published profile has `acceptingBookings: false`.
- Existing `docs/phase1724-controlled-deployment-plan.md` documents the single-function target and preservation of `inspectLegacyBookingMigration`.

## Exact scope of possible future deployment (NOT APPROVED YET)

Project: `salonbook-pro-ad5ff`. Target: `functions:publishBusiness` only. Region: `europe-west2`. Source branch: `milestone-customer-booking-experience`. Service account: `boustio-function-deployer@salonbook-pro-ad5ff.iam.gserviceaccount.com`.

No other function may be deployed or deleted. Never invoke `publishBusiness` as part of deployment. No customer booking activation, no Firestore data changes, and no changes to the two original appointments.

## Before requesting explicit deployment approval

1. Confirm live Cloud Functions inventory with a correctly classified, read-only check; a missing/not-visible result is ambiguous.
2. Verify the deployer has the necessary **least-privilege** deployment permissions, and APIs/billing are ready; working WIF impersonation is not proof of deployment rights. Do not grant broad roles speculatively.
3. Validate dependencies, Node syntax, existing publishing tests, and the exact Firebase CLI selector. Check the impact on other exported functions and on `inspectLegacyBookingMigration`.
4. Prepare a protected, manual, single-target deployment workflow with a human reviewer and fail-closed branch/project/target guards. Review its changes before use.
5. Ask the owner for **separate, explicit approval to deploy `publishBusiness` to the live project**. A general “Go” for planning is not deployment approval.
6. After an approved deployment, inspect metadata read-only; do not invoke the function or publish business data without separate approval.

## Current decision

**NOT READY TO DEPLOY.** Authentication fixed, source reviewed, metadata and deployment permissions still unverified. This document is a preparation artifact only.

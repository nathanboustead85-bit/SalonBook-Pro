# Boustio Phase 17.22 — deployment readiness (plan only)

## Verified repository configuration
- Firebase project: `salonbook-pro-ad5ff`
- Functions source: `functions`, Node.js 22, default codebase
- `publishBusiness`: callable function in `europe-west2`
- Publishing requires a verified Firebase owner, private business profile validation, and slug ownership checks.
- Public profile is written by the existing transaction with `acceptingBookings: false`.
- `getPublicBusinessProfile` is referenced by Firebase Hosting rewrites; do not disturb it.

## Pre-deployment gates
1. Confirm Phase 17.22 source audit passes.
2. Inspect the **actual live Cloud Functions inventory** and identify the one existing function by name/region. The prior read-only check reported one visible function and no `publishBusiness`.
3. Review all exported functions in `functions/index.js` and their dependencies. Publishing only one function avoids unexpectedly deploying chat/booking endpoints.
4. Confirm the Cloud Functions deployment identity, billing and required APIs separately; the restricted verification identity must **not** receive deployment permissions.
5. Confirm the private profile is valid for publishing (existence alone does not prove validity) and the chosen slug does not conflict. Use privacy-preserving checks.
6. Obtain explicit approval for the actual deployment, separately from this plan. Do not invoke `publishBusiness` until another explicit approval.
7. After any future approved deployment, verify the function status read-only, then consider a separate, owner-authorized publish operation with `acceptingBookings: false`.

## Safety rules
- Do **not** run `firebase deploy --only functions` or deploy all exports.
- A future approved deployment should target **only** `functions:publishBusiness` with explicit project `salonbook-pro-ad5ff`, after confirming no unintended removal/update prompts.
- Do not deploy, invoke, publish, migrate, or modify Firestore in Phase 17.22.
- Preserve both original appointments; never enable real customer reservations.
- Phase 17.21 inventory did not list `publishBusiness`, but that alone does not prove the cause.

# Phase 17.24 — controlled deployment preparation (no deployment)

## Current observed state
Phase 17.23 read-only inventory: `inspectLegacyBookingMigration` is visible; `publishBusiness` is not listed. The latter is exported from `functions/index.js` as a Gen 2 callable in `europe-west2`. This does not establish that the live project is otherwise ready to deploy.

## Exact future deployment target
- Project: `salonbook-pro-ad5ff`
- Firebase CLI selector: `functions:publishBusiness`
- Function region: `europe-west2`
- Source: `functions` (default codebase), Node.js 22
- Existing function to preserve: `inspectLegacyBookingMigration`

## Required independent approvals and controls before future deployment
1. Review and pass this Phase 17.24 source-only preparation workflow.
2. Inspect the **actual live** `inspectLegacyBookingMigration` metadata before and after any future deployment; preserve its configuration and behavior.
3. Confirm Google Cloud billing, Cloud Functions Gen 2, Cloud Build, Artifact Registry, Eventarc/Cloud Run requirements and deployment permissions through a **separate least-privilege deployment identity**. Never elevate the existing read-only verifier.
4. Confirm dependency installation and Firebase CLI discovery using an isolated validation job, and check that any other exported functions will not be deployed.
5. Ensure a future deploy workflow has a separate protected GitHub Environment and required human reviewer, an exact branch/commit allowlist, a separate manual approval phrase, and a final deploy-target allowlist. Never treat a typed phrase as sufficient authorization by itself.
6. Before deployment, obtain a new explicit instruction from the user authorizing the **live deployment**, not merely workflow preparation.
7. After any authorized deployment, inspect `publishBusiness` and `inspectLegacyBookingMigration` read-only. Deploying the function does not mean invoking it or publishing the business.
8. Any subsequent invocation/publishing needs another separate owner-authorized decision and privacy-safe profile/slug checks.

## Non-negotiable safety
Do not deploy all functions, do not invoke functions, do not publish a public profile, do not write Firestore, and do not enable customer bookings. Existing two appointments must remain untouched.

## Phase 17.24 scope
This phase only creates and validates a deployment preparation document and source-only GitHub Actions workflow. No cloud credentials are requested and no deployment command is executed.

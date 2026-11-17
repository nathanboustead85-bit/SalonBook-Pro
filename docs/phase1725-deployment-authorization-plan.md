# Phase 17.25 — deployment authorization gate (preparation only)

## Scope
This is a review checklist and source-only validation. It does NOT create a deployment identity, modify IAM, create or configure GitHub environments, deploy a function, or access Firestore.

## Identity separation
- Keep `boustio-readonly-verifier@salonbook-pro-ad5ff.iam.gserviceaccount.com` read-only. Do NOT grant it deployment roles.
- Before any live deployment, create a **different** least-privilege service account and a **separate** GitHub OIDC trust restricted to the exact repository, protected deployment environment, and permitted branch.
- Review the minimum permissions actually needed for Cloud Functions Gen 2 deployment (Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, service account impersonation and any other service dependencies); do not grant project Owner/Editor.
- Never put long-lived Google Cloud service account keys into GitHub.

## Protected GitHub deployment environment
- Create a distinct environment named `boustio-function-deployment` with required reviewer(s), restrict deployment to `milestone-customer-booking-experience`, and prevent self-review where supported.
- This is a MANUAL GitHub Settings action. Merely writing `environment:` in a workflow does not configure required reviewers or enforce branch rules.
- Do not store deployment credentials in the existing `boustio-readonly-verification` environment.
- Before allowing deployment, verify the environment rules are actually active, including plan-specific support.

## Future live deployment controls (not implemented or authorized here)
- Obtain a separate explicit user instruction authorizing live deployment.
- Use a single-function selector `functions:publishBusiness`, project `salonbook-pro-ad5ff`, region `europe-west2`, runtime `nodejs22`.
- Pin the reviewed commit, run source and dependency checks, compare live inventory, preserve `inspectLegacyBookingMigration`.
- A future workflow must fail closed unless its protected environment reviewer approval, OIDC restrictions, exact target, and user approval are all verified.
- No function invocation, public business publishing, or customer booking activation is implied by deployment.

## Verification needed
The Phase 17.25 workflow only tests this policy and repository configuration. A passing run does NOT mean Google IAM or GitHub environment rules have been set up.

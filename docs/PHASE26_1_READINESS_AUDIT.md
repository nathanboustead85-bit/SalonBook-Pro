# Boustio Phase 26.1 — Production readiness source audit

Status: **read-only audit, not launch approval**. Run the companion GitHub Actions workflow and inspect its test results. No deployment, Firebase access, production writes or Android installation is performed.

## Reviewed architecture and findings
- **Android:** `app/build.gradle.kts` declares application ID `com.salonbook.pro`, SDK 35, a separate debug application ID suffix, Firebase Auth/Firestore/Functions dependencies, and release signing configuration. `AndroidManifest.xml` declares internal management, chat, cloud and business profile activities as non-exported. **Follow-up:** review `android:allowBackup="true"` for private client and booking data, inspect app data backup rules and confirm production release signing/permissions.
- **Customer booking:** `website/customer/phase25-integration.mjs` exposes a synthetic journey with all four live actions disabled. **Follow-up:** verify the older hosted `website/book/index.html` and all public endpoints independently before launch; passing synthetic tests does not certify hosted routes.
- **Firebase:** `firestore.rules` includes ownership, verified-email and legacy booking-mode protections. `firebase.json` maps hosting to `website`, configures public business and booking rewrites, and declares local Auth/Firestore emulators. **Follow-up:** audit every Firestore rule and callable function against an explicit least-privilege access matrix, including unauthenticated and cross-owner access.
- **Business onboarding:** `website/business/onboarding/phase24-profile.mjs` and `phase24-policies.mjs` are demo-only and guard owner IDs. **Follow-up:** design a separate verified live registration and tenant-provisioning flow; demo completion does not mean self-service signup is live.
- **Payments:** no live payment activation is established by this audit. **Follow-up:** choose a provider, subscription lifecycle, webhook verification, refunds and cancellation handling, and confirm PCI/payment data boundaries before enabling.
- **Publishing:** `functions/index.js` includes `publishBusiness` and `unpublishBusiness`; `firebase.json` contains public hosting rewrites. The separate publish-readiness workflow is manually gated and does not itself deploy. **Follow-up:** distinguish existing server capabilities from publicly enabled features; verify production IAM, callable authorization, rollback and domain readiness before any publishing change.
- **Messaging:** Android manifest includes a non-exported `ChatInboxActivity`. Live customer chat, voice notes, storage rules, consent and retention remain separate launch-readiness work.

## Automated audit boundaries
The Node test suite checks the existence and selected static safeguards of representative Android, customer, Firebase, onboarding and publishing files. It intentionally **does not** authenticate, mutate Firestore, build an APK, invoke cloud functions, run payment transactions, or deploy. A green result is evidence that these source-level guardrails are present, **not** proof that the entire application is secure or production ready.

## Launch gates
1. Complete endpoint-by-endpoint and rules-by-rules security review with emulator-backed negative tests.
2. Verify private Android data handling, backups and release identity.
3. Implement and test live business onboarding, billing and booking authorization in isolated environments.
4. Validate messaging privacy, media limits, abuse controls and retention.
5. Run full integration, rollback, disaster recovery and monitoring checks.
6. Obtain explicit human launch approval before enabling any production feature or deployment.

**Safety:** Do not change existing appointments, do not enable registration/bookings/payments/publishing, and do not deploy.

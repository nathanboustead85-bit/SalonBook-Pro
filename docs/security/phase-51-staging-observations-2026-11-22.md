# Phase 51 — User-observed staging Firebase configuration (22 November 2026)

**Evidence type: user-provided screenshots and pasted rules; not an independent audit.** Project reported as `boustio-staging`. All seven launch blockers G1–G7 remain OPEN. No approval, deployment, or live-feature activation.

## Observations and limitations

1. **Firestore rules (user pasted):** `rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }`. This denies all client SDK document reads/writes **if it is the published rule set**. Screenshot of published revision and isolated live-staging tests are still missing. Admin SDK/server IAM bypass these rules.
2. **Authentication:** Screenshot shows Email/Password **Enabled**, no other configured sign-in provider listed. Email verification enforcement, token revocation, sessions and abuse controls not verified. SMS MFA upgrade prompt displayed, no proof of its configuration beyond the screen.
3. **Authorized domains:** Screenshot shows `localhost`, `boustio-staging.firebaseapp.com`, and `boustio-staging.web.app`, each marked Default. These restrict some auth redirect flows, not database access. Review `localhost` before release. No production domain shown.
4. **App Check:** Screenshot shows Cloud Firestore status **Unenforced**. Other API rows partly clipped; cannot claim their full status. Leave enforcement OFF pending deliberate, tested rollout.
5. **Functions:** Firebase Console displayed an **Upgrade project** prompt to use Functions and no function list. This is not independent proof that no Cloud Run, Cloud Functions, or other privileged backend exists. No upgrade requested.
6. **IAM:** Earlier user screenshots showed one human Owner and Firebase/Google service accounts; user reported no user-managed keys for the Firebase Admin SDK service account. Complete IAM least privilege and other service-account keys not verified.

## Required independent checks

- G1: confirm project and IAM isolation, key inventories, and no production credential access.
- G2: verify email ownership, auth expiry, revocation, session isolation and rate limiting.
- G3: verify published Firestore revision and deny-all client behavior with controlled staging identities; check privileged backend paths separately.
- G4: verify App Check app registration, test-only key restrictions and planned attestation without enabling enforcement.
- G5: independent staging/emulator concurrency and idempotency evidence for bookings, while live bookings remain disabled.
- G6: independently confirm payments/messaging are disabled; document quotas and attachment controls before enabling.
- G7: independently inspect Cloud Run/Functions, secrets, audit logging, rollback, billing budgets and deployment permissions.

## Hard stop

Do not merge draft PR #5, publish Firestore changes, deploy, upgrade billing, enable App Check enforcement, activate bookings/payments/messaging, or access the two original Android appointments. Reviewers must collect sanitized independent evidence and sign off separately; GitHub green checks are offline validation only.

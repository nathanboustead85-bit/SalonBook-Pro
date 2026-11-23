# Boustio Phase 57.4 — Firestore security rules verification

**Status: BLOCKED — actual version-controlled rules not located at expected root path.**

At implementation time, `firestore.rules` and `firebase.json` were not found at repository root on the Phase 57.3 branch. They may exist elsewhere or in Firebase Console; this finding does not prove that no rules exist. Do not copy guessed rules or use an open-by-default ruleset.

## Evidence required to unblock

1. Locate the **actual** current Firestore rules and verify their source of truth. Obtain a reviewed, redacted export if maintained in Firebase Console.
2. Add the reviewed rules to an approved repository path, with `firebase.json` pointing to that exact file. Avoid deploying or overwriting the Console rules during this step.
3. Create Firebase emulator tests using the exact reviewed rules: anonymous denial, cross-tenant read/write denial, unverified-owner write denial, verified-owner permitted cases, booking mode and backup restrictions, and deny-by-default unknown paths.
4. Run emulator tests against disposable synthetic data only, record run ID and hashes, and obtain independent review. A passing Node preflight **does not** count as Firebase emulator verification.
5. Independently review any differences between deployed rules and repository rules before staging execution.

**Safety:** G1–G7 OPEN. Phase 57.1–57.3 evidence gates unchanged. No Firebase access, rule publishing, deployment, real bookings, payments, messaging or App Check enforcement. Two original Android appointments: DO_NOT_TOUCH.

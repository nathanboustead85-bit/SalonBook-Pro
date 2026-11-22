# Phase 49.3 — Independent backend security verification preparation

**Procedures only, no real staging access.** This phase documents six independent evidence requirements: Firebase Admin `verifyIdToken(token, true)` with valid, revoked, expired and tampered tokens; backend and Firestore cross-owner isolation; session expiry and account switching; short-lived keyless identity and least-privilege IAM; concurrent revocation; and independent reviewer evidence.

For each test, a separately approved staging reviewer must record the approved non-production project boundary, test identity, expected and observed outcome, redacted trace, date, findings, remediation and signed approval **outside source control**. Synthetic emulator tests and self-asserted approvals cannot close blockers.

No Admin SDK is initialized and no credentials are read. All seven launch blockers remain OPEN; the two original Android appointments are NOT ACCESSED OR VERIFIED. Bookings, payments, messaging and deployment remain disabled.

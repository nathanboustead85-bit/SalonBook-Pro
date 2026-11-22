# Boustio Phase 38.3 — Isolated owner authorization and session boundary

Source-based scope: verified-owner Firestore rules for private profile, services and staff; dependency-injected read-only atomic business reader; strict Phase 38.2 schema gate; and isolated session generation fence. Synthetic tests verify two distinct owners, cross-owner and unverified/anonymous denials, token expiration and mismatches, sign-out, account switching, network loss and stale in-flight reads. Appointment and server-only reservation writes are explicitly denied by the existing rules.

**Security boundary:** `createOwnerAuthorizationGate` is an isolated opt-in module, not a replacement for the live Android app or the Phase 37 browser session. It never initializes Firebase or writes. The emulator suite seeds synthetic documents only through the local rules-disabled test harness; it cannot reach production.

**Remaining blockers:** production token revocation, App Check, independent rules audit, browser integration of this new gate, real cross-device verification and all live booking/payment/messaging features remain unapproved. No deployment or production rules changes. Two original Android appointments are not accessed.

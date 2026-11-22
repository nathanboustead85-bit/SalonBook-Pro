# Phase 40.4 — Isolated session security and recovery

Introduces `createSecureRecovery`, an opt-in read-only wrapper around the Phase 39 view-model. It requires an injected **trusted revocation verifier** that must explicitly return `true`; a missing verifier, false/unknown result or rejection fails closed. Forced token refresh, expiry and owner claim checks are required before a read. Epoch fencing invalidates pending requests on sign-out, account change, offline transition, background and stop. Reconnect and foreground require new verification; old business data is cleared first.

Negative tests exercise expired and malformed tokens, revocation rejection, concurrent owner changes, sign-out, offline/reconnect and teardown. Local Firebase Auth/Firestore emulators verify owner-only reads with synthetic documents.

**Limitations:** This phase does not implement a real Firebase Admin revocation check, production App Check, deployed auth observer, or production token revocation monitoring. A caller must provide an independently trusted verifier and real auth/session integration in a later approved staging environment. Existing Phase 39 session and Android schema remain unchanged. Passing tests is not launch approval.

The two original Android appointments are never accessed or migrated. Live bookings, payments, messaging and deployment remain disabled; no production rules or configuration are changed.

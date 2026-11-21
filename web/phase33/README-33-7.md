# Phase 33.7 — Offline session lifecycle and business isolation

A deterministic, pure in-memory state machine composes Phase 33.6's dashboard refresh and Phase 33.5's validated assembly. Sign-out, session expiry, account switching, refresh failure, request mismatch and cross-owner data invalidate or clear dashboard content. Monotonic session epochs prevent old responses from being accepted in a new session even when request IDs are reused. The module requires a verified owner and future expiry timestamp supplied by a trusted caller.

**Not connected to real Firebase Authentication or Firestore.** The `signOut` function clears this module's local display state only; it does not sign out Firebase credentials. A future authenticated integration must verify tokens and expiration against the trusted SDK, cancel in-flight requests and prevent old callbacks from mutating UI. There are no live booking, payment, messaging, Android appointment, storage or deployment changes.

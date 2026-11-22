# Phase 39.2 — Isolated unified browser authentication/session lifecycle

Opt-in composition of Phase 39.1 reader, Phase 38 owner authorization, and Phase 38 recovery with a browser-style injected `auth.currentUser` and forced `getIdTokenResult(true)`. Identity is checked both before and after asynchronous token refresh, and generation fencing blocks stale results on sign-out, account switching, and network loss. Session subscribers see an unavailable state at boundaries. All capability flags remain false.

This is an isolated contract and not wired to a public browser route or production Firebase. The client-side token check is defense-in-depth, not revocation verification; production token revocation/App Check, real auth observer wiring, cross-device testing and independent authorization audit remain P0 launch blockers. The two original Android appointments are not accessed. Live bookings, payments, messaging and deployment remain disabled.

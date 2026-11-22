# Phase 42.4 — Isolated session recovery and cross-device consistency audit

Read-only, emulator-only session audit wrapping Phase 42.3. Every recovery must revalidate identity and token expiry. Pending responses are fenced on account switch, offline, sign-out and teardown. Independent device instances never share an authenticated in-memory state.

Synthetic tests cover token expiry, repeated reconnects, parallel device instances, auth failures and delayed responses. Emulator tests verify permitted synthetic owner reads and denied cross-owner/unverified reads.

**Limitations:** Independent instances do not prove actual cross-device consistency; Android v1 lacks verified shared revision. Injected revocation is not a trusted server-side revocation backend. No App Check or production readiness is asserted.

No Android appointment reads/migrations, no live bookings, payments, messaging, production Firebase changes or deployment.

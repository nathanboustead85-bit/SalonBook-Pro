# Phase 41.2 — Isolated Firebase SDK authentication lifecycle adapter

An opt-in adapter validates Phase 41.1 emulator-only environment and injected Firebase SDK shapes before subscribing to auth state. It does not initialize Firebase or connect to a real staging/production project. Forced token refresh, verified owner claims, token expiry and an injected trusted revocation verifier are required before exposing an isolated read-only dashboard state.

Every auth observer event clears prior business data synchronously. Request epochs and user object identity fence stale responses across sign-in, sign-out, same-UID token transitions, cross-owner switches, observer errors and teardown. Failed revocation checks fail closed. All live capabilities are disabled.

**Boundaries:** The injected verifier is a contract, not a real Firebase Admin revocation service. The environment validator is not a firewall. A caller must wire actual SDK emulator connections separately; this phase does not deploy, connect to production, migrate Android data, or approve staging. Phase 40.5 P0 blockers remain OPEN. Tests use synthetic users and local Firebase emulator rules; the two original Android appointments are never read or modified.

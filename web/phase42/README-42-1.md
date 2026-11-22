# Phase 42.1 — Isolated staging integration gap resolution

Adds one dependency-injected composition for emulator-only SDK contract, auth observer, forced token validation, injected revocation decision, atomic read-only Firestore reader and Phase 41.4 recovery. No Firebase app is initialized, no remote staging is connected, and no production configuration is used.

On offline, sign-out, account switch or teardown, displayed data clears immediately; reconnect requires a fresh token, revocation decision and atomic Firestore read. Emulator tests use synthetic records and local Firestore rules. The injected revocation callback is **not** a trusted backend; returning true in a test does not resolve trusted revocation or App Check launch blockers.

Phase 41.5 P0 blockers remain open. Android v1 still has no verified shared revision or business-wide hours. The two original Android appointments are not read, migrated or changed. No live bookings, payments, messaging, production changes or deployment.

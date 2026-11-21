# Phase 33.8 — Offline dashboard permissions and read-only enforcement

Pure deny-by-default display policy for Phase 33.7 verified sessions and Phase 33.6 assembled dashboard snapshots. Allows only five explicit view actions (business, services, staff, opening hours, summary), after matching principal UID, verified email, current session, snapshot owner, expiry, and disabled booking/edit flags. Rejects all unknown actions, mutations, booking/payment/messaging actions, stale or cross-owner sessions. Results never contain callable mutation methods.

This is **not** Firebase Authentication or Firestore Rules authorization and is not a substitute for server-side access control. The caller-provided principal, timestamps and session must be trusted by a future integration. No live data reads/writes, Android appointment access, production rules modifications, deployment or feature enablement.

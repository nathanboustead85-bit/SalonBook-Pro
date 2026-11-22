# Phase 37.3 — Reactive isolated browser dashboard

The Phase 36.3 authentication controller now publishes changes to subscribers, including loading, verified ready, unavailable, sign-out, network loss, and stop. Phase 36.4 projects those states and Phase 36.5 audits each state before publication. Phase 37.1 renderer can subscribe and unsubscribe; Phase 37.2 browser integration uses those subscriptions instead of 80ms polling.

The browser still runs only on loopback, with Firebase Auth and Firestore emulators for project demo-boustio-phase37-2. Playwright tests cover token refresh, sign-out, owner switching, network recovery and disabled live actions. Existing Phase 37.2 and Phase 36.5 tests remain regression gates. No production initialization or deployment is performed.

The isolated preview does not establish production session revocation, App Check, customer booking readiness or live deployment safety.

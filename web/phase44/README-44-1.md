# Phase 44.1 — Isolated Firebase Admin verification contracts

The injected adapter models Firebase Admin Auth `verifyIdToken(token, true)` (revocation check) and Admin App Check `verifyToken(token, {consume:true})` (consumed-token/replay checking). It requires an explicit synthetic approved app allowlist, verified non-anonymous identity, bounded token and authentication age, fail-closed errors, and epoch-based stale-response fencing.

**This is contract preparation, not real trusted staging:** no Admin app is initialized, no service account or real tokens are used, and App Check consumption is not validated against a real provider. Actual replay consumption may require additional provider configuration and server-side protections. Emulator access tests verify Firestore rules, not Admin token provenance. All seven Phase 43 launch blockers remain open.

Only synthetic emulator data is used. Two original Android appointments are untouched by these changes. No production Firebase, deployments, payments, live bookings or messaging.

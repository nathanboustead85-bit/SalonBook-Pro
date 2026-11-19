# Boustio Phase 26.9 — Anonymous abuse and App Check launch preparation

## Scope
Static, fail-closed CI regression checks for existing messaging safeguards. This phase does not deploy, change callable handlers, turn on messaging, or alter production data. The audit deliberately confirms **known launch blockers** rather than claiming they are fixed.

## Findings
- Anonymous Firebase users can rotate identities. The conversation ID is keyed by business ID and UID; per-conversation limits do not prevent account-rotation spam.
- App Check enforcement is currently false on customer chat callable functions.
- Existing ownership checks, Firestore transactions, per-conversation quotas and cooldowns are useful but insufficient against cross-account abuse.
- Photo and voice upload endpoints remain unimplemented and must stay disabled.

## Requirements before live launch
1. Implement server-side, privacy-conscious abuse budgets across rotating accounts (e.g., risk signals, business-wide burst ceilings, time windows and escalation); design for legitimate shared networks and avoid storing raw IP addresses unnecessarily.
2. Configure Firebase App Check for supported Android and web clients. Verify valid, invalid, missing and replayed attestations against callable HTTP transport in staging. App Check is a defense in depth, not a substitute for abuse limits.
3. Add monitoring, alerting, moderation, retention and support processes.
4. Run authenticated integration and concurrency tests using emulators, then stage real-client verification.
5. Obtain explicit approval before any production deployment or feature activation.

## Safety
No customer chat, public bookings, voice/photo uploads or production deployments are enabled. Existing appointments are not modified.

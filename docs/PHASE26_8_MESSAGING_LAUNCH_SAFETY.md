# Boustio Phase 26.8 — Messaging launch safety audit

## Scope
Read-only source checks in CI. Phase 26.7 already exercises Firestore emulator transactions. Phase 26.8 guards against accidental weakening of the chat feature flag, ownership checks, quota/cooldown, and text-only API surface. It does **not** enable messaging or deploy anything.

## Blocking findings
- Anonymous account rotation can evade the per-conversation 100-message quota. Introduce server-enforced cross-account rate limits and operational monitoring before launch.
- Customer chat callables have `enforceAppCheck: false`. Configure and validate App Check for supported clients, and test enforcement before release.
- Photo and voice attachments are not implemented. Keep uploads disabled until authenticated upload endpoints, file-type/size validation, malware/content handling, retention policy and Storage rules are tested.
- Current limits (5 seconds and 100 messages) are per conversation, not durable per device, IP, business, or account-rotation cluster.
- Phase 26.7 calls handlers directly with simulated identity; callable HTTP/Auth transport, App Check token verification and production IAM remain untested.

## Release gates
1. Design privacy-conscious, durable abuse controls and test identity rotation under emulator load.
2. Enforce App Check and verify rejection of invalid/missing attestations.
3. Add alerting, support moderation, reporting, retention and incident response.
4. If attachments are enabled later, enforce safe upload constraints and Storage rules.
5. Test on Samsung and browser using staging credentials, then obtain explicit approval before any deployment.

**Safety:** Existing appointments, production Firebase data and booking flags are untouched. No production deployment or live chat activation.

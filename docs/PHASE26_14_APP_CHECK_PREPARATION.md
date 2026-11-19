# Phase 26.14 — App Check preparation and abuse-prevention launch blockers

This phase is **preparation and audit only**. No App Check enforcement, messaging, uploads, or booking is activated. No deployment.

## Findings
- The three chat callable handlers still specify `enforceAppCheck: false`. This is a **launch blocker**, not a passed security control.
- Anonymous Firebase account rotation defeats per-UID limits. The business-wide quota is a limited safeguard and risks rejecting legitimate customers.
- The atomic abuse budget is gated behind `BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED`, default off.
- A **trusted server-side abuse signal** and enforcement strategy are still needed. Never accept client-supplied risk signals.
- Operational monitoring, TTL cleanup, and abuse-response policy are outstanding.
- Real callable transport and Firebase App Check token verification are not covered by the mocked-identity emulator tests.
- No photo/voice attachments should be enabled without separate storage rules, validation and scanning.

## Next phase
26.15: independent security review and launch-readiness assessment; do not interpret a green audit workflow as permission to launch.

The `chatLaunchReadiness` helper is a declarative checklist, **not** a cryptographic verification of configuration or an enforcement gate. Passing all its hypothetical inputs does not prove App Check or monitoring exists.

# Phase 43.4 — Isolated secure dashboard recovery integration

A fail-closed composition connects Phase 43.3 injected token/App Check/replay policy to Phase 42.4 read-only dashboard session recovery. It clears the displayed business on offline, account switch, sign-out, invalid policy, concurrent refresh and teardown; checks policy before reading and again after the read with a distinct synthetic replay nonce. All results are fenced by identity and request epoch.

**Not staging approval:** injected token, App Check and replay callbacks are synthetic, not a trusted backend. The policy's caller-supplied replay nonce is not real request-bound replay protection. Real staging, production App Check enforcement, shared cross-device revisions, Samsung acceptance and all Phase 42.5 launch blockers remain open.

No Android appointment access, migration or changes. No production Firebase data, configuration or rules modifications. Live bookings, payments, messaging and deployment remain disabled.

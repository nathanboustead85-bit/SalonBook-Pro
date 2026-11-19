# Phase 27.1 — Messaging security hardening: fail-closed release preflight

**Status: implementation prepared; public messaging remains BLOCKED.**

Phase 26 identified critical launch blockers. Phase 27.1 adds a standalone immutable preflight that reports configuration gaps and independently required evidence. It deliberately never returns approval, even when callers supply all true flags: configuration strings and simulated evidence are not proof of attestation, security monitoring or human authorization.

## Remaining engineering work
1. Configure and verify Firebase App Check for supported web/mobile clients in a staging environment, including legitimate traffic, invalid tokens and replay protections. **Do not flip production callable enforcement yet.**
2. Design privacy-conscious server-derived abuse correlation across rotated anonymous accounts; test false positives and rate-limit denial-of-service scenarios.
3. Implement verified monitoring, retention/TTL, incident response and audit trail without exposing sensitive content.
4. Exercise actual callable HTTP/Auth/App Check token validation rather than mocked request objects.
5. Confirm attachment uploads remain disabled until storage authorization, type/size checks and scanning pass.
6. Obtain independent security signoff and explicit production approval before any release.

No deployment, production configuration change, live customer messages or booking modifications. Phase 27.1 tests are a *preflight safety check*, not proof of security completion.

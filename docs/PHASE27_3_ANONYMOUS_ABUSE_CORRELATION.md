# Phase 27.3 — Anonymous identity rotation and trusted correlation (staging only)

**Status: isolated prototype and tests, NOT production protection.**

Existing per-UID limits can be bypassed by creating new anonymous Firebase identities. Phase 27.3 adds an isolated HMAC-SHA256 correlation helper and transaction-scoped counter, intended for a future **trusted server-derived** abuse signal. It demonstrates that different anonymous UIDs can share a correlation budget when a reviewed trusted source can establish common abuse activity. A customer-provided signal must never be accepted.

## Security and privacy limitations
- **No reliable trusted source of per-actor evidence exists yet.** This module must not be wired to customer chat until one is designed, validated and privacy-reviewed.
- Firebase App Check app IDs identify registered apps, **not individual people or devices**. Never rate-limit all customers by app ID alone.
- Raw IPs, browser fingerprints, user agents and customer identifiers must not be logged or stored as correlation evidence without a documented lawful basis, minimisation, retention and false-positive safeguards.
- HMAC keys must be held in server-only secret management, rotated with a migration plan and never sent to clients.
- Counter expiry is a timestamp field only; Firestore TTL configuration is not performed here.
- Mocked transaction tests are not emulator concurrency tests. Integrate with the existing atomic message transaction only after trusted evidence and full emulator tests are available.
- Shared connections and household devices can cause false positives. Include appeal, backoff, alerting and abuse-incident procedures before launch.

No Firebase deployment, no customer messages, no new production restrictions, no booking modifications. Live messaging remains disabled.

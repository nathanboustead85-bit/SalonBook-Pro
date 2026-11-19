# Phase 26.12 — Atomic messaging abuse-budget integration

Both customer conversation creation and customer message sending now optionally consume the hourly per-identity and business-wide budget **inside the same Firestore transaction** as the message write. If the quota is exceeded, the transaction throws a resource-exhausted error and neither the message nor budget increments are committed.

**Both switches remain disabled:** `BOUSTIO_CHAT_ENABLED` and `BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED` are not enabled by this change. No deployment or live activation.

Limitations: No trusted cross-account risk signal is integrated. Business-wide quotas are only a partial mitigation for rotating accounts and can block legitimate customers. App Check remains off. This workflow performs static and syntax checks; real callable integration emulator tests under the new flag are required before launch. TTL and monitoring are not configured. Existing appointments are untouched.

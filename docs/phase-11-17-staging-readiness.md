# Phase 11.17 — staging transport harness (NOT a deployed staging environment)

The test harness uses an explicitly injected fetch function and a synthetic HTTPS host under `staging-*.example.test`. It rejects real domains and HTTP. The harness is intentionally not exported from the Firebase production entrypoint.

This verifies request shape, redirects disabled, timeout, owner-token presence, response size/type, business/date matching and booking ID uniqueness. It does **not** establish a real staging Firebase project, perform live owner authentication, connect the phone, or activate bookings.

Before any real staging connection, obtain explicit permission and a separate non-production Firebase project, configure authenticated service identity and allowlists, verify deployment costs and rules, test an Android debug build against staging, and review privacy and security. Production is on HOLD.

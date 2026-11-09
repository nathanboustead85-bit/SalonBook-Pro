# Phase 11.16 — Android cloud connection safety contract

Development-only source: `app/src/debug/java/com/salonbook/pro/debug/SecureCloudCalendarContract.kt`.

This phase validates a future HTTPS-only endpoint, synthetic business ID, owner token and UK date. The host allowlist is deliberately **empty**, so the prototype cannot connect to any remote server. No network client or live credentials are included. Existing emulator-only calendar adapter remains unchanged.

**Next gates before remote connectivity:** approved staging host, verified owner sign-in and business ownership on server, token expiry and rotation, privacy/security review, authenticated endpoint integration tests, UI connection/error states, explicit deployment approval, and Android end-to-end testing.

Do not enable public bookings or deploy to production. Protected production bookings and existing Boustio app remain untouched.

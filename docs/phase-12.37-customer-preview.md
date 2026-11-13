# Phase 12.37 — Customer booking journey preview

This phase returns to customer-facing design without enabling customer booking writes.

- Open `web/phase1237/index.html` together with `bookingPreview.js` in a browser or static web server to see the mobile-first prototype.
- Demonstrates service selection, sample times, customer name validation, and a **PREVIEW ONLY** confirmation.
- All service names, prices and time slots are illustrative and hard-coded. They are not derived from real business data or live availability.
- No Firebase SDK, API calls, payments, customer accounts, confirmation messages, or appointment writes.
- No deployment to boustio.co.uk or change to production booking mode.
- Existing Android APKs and the user's two original appointments are untouched.

Next implementation should connect a safe read-only published catalogue and real slot generation in a nonproduction environment, followed by owner-approved backend booking flows only after access control and conflict testing.

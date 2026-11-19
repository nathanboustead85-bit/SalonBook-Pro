# Phase 28.1 — Premium customer booking website foundation

Created a responsive teal-and-white customer-facing **preview** at `web/phase28/index.html` based on the approved premium direction. It reuses the existing Phase 12 catalogue presentation and Phase 13 public business profile validation instead of inventing a new schema. The interface displays services, prices, professionals, fictional dates/times, and an updating summary.

**Important:** This phase is a static preview, not live Firestore integration. The demonstration uses a fictional public-shaped Kody Blends catalogue and does not fetch a business from Firebase. A future phase must provide an independently authorized public catalogue reader, validate real slug resolution, verify rules and production schema, and connect trustworthy availability only after booking launch approval. No customer details, bookings, messages or payments are submitted. `bookingEnabled` is always false; the confirmation button is disabled.

To inspect the preview, open `web/phase28/index.html` in a static web server with the parent `web` directory available. No deployment is performed by this phase.

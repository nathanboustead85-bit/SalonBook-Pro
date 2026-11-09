# Phase 11.15 — secure cloud calendar connection readiness

Status: **contract and local tests only**. No cloud deployment, public booking endpoint, Android cloud connection, or production data access.

The current Android debug adapter uses a loopback HTTP endpoint that cannot be reached from an ordinary Android phone without a local emulator/bridge. Phase 11.15 adds an emulator-guarded, owner-authorised, read-only cloud transport contract. It does **not** pretend the physical phone is connected.

A future cloud service needs a separately approved deployment plan: verified Firebase identity, owner/business binding on every request, HTTPS-only transport, no persistent bearer tokens in logs, least-privilege Firestore rules, rate limits, error handling, UK local date handling, deduplication by booking ID, and cancellation propagation. The Android client must have a separately tested authenticated remote adapter before rollout.

Production Firebase project salonbook-pro-ad5ff, existing booking records and website/book/index.html remain **HOLD**. Do not export this module from functions/index.js. No public bookings until explicit approval.

# Phase 59.17 — Business chat photo and 60-second voice previews

Adds a reusable browser media controller at `web/chat/media-controls.js` with strict client-side MIME/size checks, microphone permission handling, a 60-second recording timer, local attachment preview and removal, media track cleanup, and no network/persistence APIs. The business inbox gains photo and voice controls and local-only preview replies; the existing customer preview from 59.15 retains its media controls.

**Not production security:** Browser checks are advisory. Backend decoding, trusted duration checks, authenticated participant authorization, anti-abuse and independent staging verification are required before any upload is enabled. Microphone recording requires HTTPS or localhost in supported browsers. Browser UI is not deployed. The seven launch blockers remain OPEN; live bookings, payments, messaging and deployment remain disabled. No Android code or stored appointments changed.

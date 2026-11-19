# Phase 24.7 — Booking policies and business preferences

A synthetic, local-only premium business settings demonstration. Includes cancellation notice, minimum booking notice, booking window, appointment buffers, customer notes, staff choice, required phone number and customer-facing policy text. Preview shows policy wording but **does not enforce live availability or accept bookings**.

Demo changes are validated against explicit numeric option lists and booleans, and saved to sessionStorage under a synthetic owner-scoped key. This is **not authenticated security**. Recovery rejects owner mismatches and malformed preferences. The UI renders user text via textContent.

36 automated tests cover settings, validation, preview, save/recovery, mobile/desktop Chromium, keyboard controls, disabled live actions, no outbound requests, and denied Firestore access via isolated Firebase Auth/Firestore emulators. No deployment, production Firebase writes, Firestore rules modifications or Android appointment changes. Registration, real bookings, payments and publishing remain disabled.

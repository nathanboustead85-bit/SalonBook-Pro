# Phase 37.1 — Isolated premium browser dashboard

Premium teal-and-white responsive browser page, DOM-only renderer and an isolated browser entry point. Read-only services and staff display after an audited owner session reports READY. Signed-out, loading, unavailable and recovery states clear all private DOM content. No live booking, editing, payment or messaging controls are available.

The browser page intentionally has **no production Firebase configuration or login**. `connectIsolatedSession` accepts a dependency-injected audited session from Phase 36.5; a full browser Firebase Auth/Firestore SDK bootstrap, real browser-to-emulator wiring and production-safe deployment gates remain future work. Node/JSDOM browser-DOM tests run here, and CI reruns the existing real Firebase emulator audit from Phase 36.5. This does not establish end-to-end Playwright browser authentication.

The preview must not be deployed to production. No production Firebase rules/configuration, Android appointments or live bookings are touched.

# Phase 25.7 — Premium synthetic customer booking experience

Additive teal-and-white customer-facing prototype with premium salon hero, five clearly labelled steps, responsive mobile/desktop layout, accessible buttons, back/reset navigation, fictional service and professional selection, illustrative availability and a booking summary. The demonstration is isolated from production and builds on Phase 25.6 read-only selection and Phase 25.5 availability checks. The review says **DEMO ONLY — NOT BOOKED**. No personal customer details are collected.

Browser fixture and test entrypoint are test-only and use fictional sessionStorage. The selected step and review exist only in memory and reset on page reload. All real bookings, registration, payments and publishing remain disabled. No deployment, production Firebase or Android appointment changes. GitHub Actions runs Node tests, real Chromium mobile/desktop/keyboard checks and isolated Firebase emulator denial tests.

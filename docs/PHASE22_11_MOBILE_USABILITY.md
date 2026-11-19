# Phase 22.11 — Premium mobile usability

The isolated premium teal-and-white business dashboard preview now includes 44–48px mobile navigation targets, keyboard focus indicators, stacked business profile fields on narrow screens, long-text wrapping, narrow-screen spacing and reduced-motion support. Navigation and all read-only features are preserved. The layout is designed to fit 320–390px mobile widths.

The GitHub Actions workflow runs 45 real Chromium tests using isolated Firebase Auth and Firestore emulators: the previous 40 checks plus 5 mobile tests for touch targets, narrow profile layout, keyboard focus, long business descriptions and disabled feature controls. CI success is required before declaring Phase 22.11 complete.

No deployment, production Firebase or Android data changes. Editing, registration, customer bookings, publishing and live dashboard remain disabled. Existing appointments are untouched.

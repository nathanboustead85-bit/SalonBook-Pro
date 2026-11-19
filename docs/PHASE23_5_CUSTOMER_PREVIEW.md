# Phase 23.5 — Premium synthetic customer preview

Added noneditable example customer details (Alex Example, alex@example.invalid, synthetic phone), selectable demonstration appointment preferences (no preference, quiet appointment, styling advice), and an example service-price total in the booking summary. Retained premium Kody Blends teal-and-white service cards, staff profiles, month navigation, sample dates and times. All customer details are hard-coded fictional data, held only in the page; there are no customer input forms, no real bookings, registration, payments, live dashboard, network writes or deployment. Production Firestore rules and existing appointments remain unchanged.

The dedicated GitHub Actions workflow runs 26 Chromium browser checks with isolated Firebase Auth and Firestore emulators. Check the workflow logs before declaring tests passed.

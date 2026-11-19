# Phase 28.9 — Customer details and booking preferences (demo only)

Adds optional customer name, email, phone, appointment notes and a three-choice preference selector to the premium offline booking preview. Inputs are explicitly labelled **demo** and users are asked to enter fictional information. They exist only in memory in the open browser page; no form submission, local/session storage, network, Firebase or production integration is introduced. The review shows only the **number of contact fields entered**, whether notes exist, and the chosen preference; it does not echo private names, email, phone or notes. Start again clears all customer inputs.

Seven isolated Playwright tests cover fields, privacy-safe review, reset, disabled confirmation, no persistence/network and Samsung/desktop layout. Previous 15 tests run unchanged. Live bookings, messaging, payments and production deployment remain disabled. No existing appointments are touched.

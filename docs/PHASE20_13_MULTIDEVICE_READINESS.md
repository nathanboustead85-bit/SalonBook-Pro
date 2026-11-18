# Phase 20.13 — Multi-device browser reliability

**NO-GO for production.** Public registration and customer bookings remain disabled. No production deployment, Firebase rule changes or Android appointment modifications.

Added four Chromium Playwright tests that open two **independent browser contexts** to simulate separate devices. They cover:
1. Different business identities with rejected cross-owner profile snapshots.
2. Offline transition on one context clearing its private profile while the second context remains unaffected.
3. Two simultaneous sessions for the same owner requiring fresh data after one reconnects.
4. Sign-out, account switching and teardown on one context without affecting the other.

Tests exercise the existing Phase 20.12 opt-in session recovery coordinator with isolated in-browser dashboard and authentication stubs. No live Firestore listener, actual multi-device hardware or production Firebase authentication is used. This is **browser-context isolation coverage**, not proof of end-to-end multi-device synchronization.

The existing 43 Firebase emulator tests and seven Chromium tests remain; four new tests bring the expected total to 54. Both jobs must pass before this phase is verified.

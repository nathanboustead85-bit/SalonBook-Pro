# Phase 40.2 — Isolated browser dashboard mount and auth observer

An opt-in browser adapter is introduced in `browser-dashboard-40-2.js`. It accepts injected `onAuthStateChanged`, `auth` and the existing read-only view model. It **does not** initialize Firebase or register a public route. The adapter synchronously clears displayed business information on observer transitions, renders only text nodes with accessible status announcements, and detaches subscriptions on unmount. The underlying Phase 39 session retains its generation/identity checks; the adapter adds an observer epoch fence.

Playwright tests exercise synthetic mount, sign-out, account switching, error handling, stale responses and teardown. Emulator tests use synthetic owner and cross-owner Firestore accounts and existing Phase 39 integration checks. No real production browser connection, deployed website, payment or messaging is enabled.

**Known limitation:** the browser adapter assumes the injected auth observer updates `auth.currentUser` consistently and that its read-only view model performs generation-fenced validation. This is not a production authorization guarantee. Phase 40.3 must still address business-wide opening hours and shared revisions. Do not migrate or access the two original Android appointments.

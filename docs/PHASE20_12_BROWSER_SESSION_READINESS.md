# Phase 20.12 — Browser session recovery

**Release decision: NO-GO.** No production deployment, public registration or customer bookings.

Added an opt-in, fail-closed browser session coordinator. It clears private profile data on startup, auth changes, offline transitions and shutdown. Restoring authentication is asynchronous and generation-guarded, so stale restoration results cannot reattach a previous owner. Reconnection revalidates authentication; a restored identity never restores cached private profile content.

Four Playwright Chromium tests exercise reload, tab reopening, offline/online recovery, and account switching/sign-out. A local-only HTTP fixture uses a **test-only sessionStorage token stub**, not real Firebase Auth. In production a server-validated Firebase Auth adapter must replace this stub. No website entry point imports the coordinator; nothing is activated. New-tab sessionStorage isolation is tested only for tabs created independently (not via window.open, which can clone initial sessionStorage). Real Firebase browser SDK session restoration remains future work.

GitHub Actions retains 43 Firebase emulator tests and 3 Phase 20.11 Chromium tests, adding 4 Phase 20.12 tests (50 expected). Do not claim passing until the workflow completes successfully.

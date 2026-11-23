# Phase 58.6 — Android persistence verification

Adds Robolectric local Android simulation tests for `SharedPreferences` on an **isolated, random disposable preference name**. Verifies initial committed values are readable through a fresh preferences handle; invalid incoming data and preview validation do not mutate preferences; discarded editors do not persist; and a committed synthetic update is readable from a fresh handle.

These tests execute Android API simulation through Robolectric on GitHub Actions, **not a real Samsung phone or an actual process-kill test**. A fresh handle is not a fresh OS process. The production `salonbook_data` preferences and active backup/restore code remain untouched. No claim of crash-safe production restore is made.

All seven launch gates G1–G7 remain OPEN. Live bookings, payments, messaging, App Check enforcement and deployment remain disabled.

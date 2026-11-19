# Phase 28.7 — Booking preview experience polish

The offline Samsung premium preview now shows a four-step progress indicator (service, professional, sample date, sample time), a keyboard-accessible **Start again** button and a clear preview-complete state. The final confirmation remains disabled even after all four selections. Demo dates and times remain fictional. The build remains self-contained, noindex, and without network or Firebase calls.

Five new Playwright tests cover the progress stages, reset state, 360px Samsung viewport, desktop viewport, keyboard reset and permanently disabled booking. No production deployment or live data changes.

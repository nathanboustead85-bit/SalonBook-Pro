# Phase 22.8 — Read-only opening hours and staff availability

**Status: committed, GitHub Actions pending. No deployment.**

This phase adds a premium teal-and-white staff availability section to the existing dashboard's Staff tab. It reads the same verified-owner-scoped `users/{uid}/liveData/staff` snapshot, accepts explicitly structured `workingHours` keyed by weekday (capitalized or lowercase), and displays valid 24-hour start/end times or closed days. Malformed and unsupported schedule shapes are not interpreted as availability.

**Business-wide opening hours:** the verified dashboard integration currently provides no confirmed business-hours data source. The UI explicitly says these hours are unavailable, rather than guessing or inventing them. Future work must identify and validate the authoritative source before showing business hours.

No editing, booking submission, production Firebase access, rules changes or deployment. Public registration, customer bookings and the live dashboard remain disabled. Android appointments are untouched.

**Tests:** 25 existing real Chromium browser checks plus 5 new availability, privacy, sign-out and fail-closed checks. Run against isolated Firebase Auth/Firestore emulators with `demo-boustio-phase21`. Acceptance requires 30/30 passing.

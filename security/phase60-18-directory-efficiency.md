# Phase 60.18 — Client directory efficiency

Parse local booking names once per client directory refresh, index appointment counts case-insensitively, and reuse the index for sorting, row counts and total. No storage schema change, no booking writes, no Firebase access. Preserve existing client search, sorting and unreadable-data guard. Signed isolated TEST build 11, version 0.2.9. Seven launch blockers remain open; live bookings, payments, messaging and deployment disabled.

Automated source regression tests plus signed APK build. If installed, one brief Samsung check of appointment counts and Most appointments sorting is sufficient; never clear app data or touch DEV original appointments.

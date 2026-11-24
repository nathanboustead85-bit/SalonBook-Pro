# Phase 60.17 — Safe client directory unavailable state

When local client records are unreadable, the directory must not claim the user has no clients. Show an explicit unavailable-data warning and retain the Phase 60.16 fail-closed write guard. Existing booking and client storage untouched. Build 10 (0.2.8) for isolated Boustio TEST, stable signing required. Seven launch blockers stay open; no live bookings, messaging, payments or deployment.

Automated checks cover unavailable/empty/no-match state distinctions, write guard, package and version. One optional Samsung smoke test is sufficient after in-place installation; do not clear app data or corrupt genuine client records for testing.

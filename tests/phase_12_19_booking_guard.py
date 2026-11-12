#!/usr/bin/env python3
"""Static regression checks for the Phase 12.19 Android booking safety guard."""
from pathlib import Path

source = Path("app/src/main/java/com/salonbook/pro/MainActivity.kt").read_text()
assert "other.id == existing?.id" in source, "Editing must exclude only the current booking"
assert "other.date != date || other.staffId != staffId" in source, "Conflicts must be staff/date scoped"
assert "runCatching { toMinutes(other.time) }.getOrNull()" in source, "Invalid saved times must not crash"
assert "otherStart == null || otherStart !in 0..1439" in source, "Malformed saved times must block"
assert "other.duration <= 0 || otherStart + other.duration > 1440" in source, "Invalid saved durations must block"
assert "start < otherStart + other.duration && otherStart < start + duration" in source, "Intervals must overlap strictly"
assert "if (existing == null) bookings.add(booking)" in source, "Editing must not append another booking"
assert "if (!withinWorkingHours(member, date, start, start + duration))" in source, "Staff hours must be enforced"
print("Phase 12.19 source regression checks passed (8 assertions).")

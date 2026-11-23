# Phase 58.5 — Disposable restart and interruption tests

Run actual Kotlin/JUnit local JVM tests on temporary synthetic files. Scenarios: re-read original appointments after simulated restart; interrupted pre-commit restore preserves originals; invalid duplicate booking IDs cannot overwrite state; completed synthetic replacement survives a new read; repeated validation remains read-only.

**Important limitations:** This is **not Android process-death instrumentation** and not SharedPreferences transaction or real-device rollback verification. The tests use JVM temporary files and a same-filesystem atomic move. No active `CloudActivity` restore code is changed. No real appointments, Firebase, production rules or deployment are accessed.

All G1–G7 remain OPEN; live bookings, messaging, payments, App Check enforcement and deployment remain disabled.

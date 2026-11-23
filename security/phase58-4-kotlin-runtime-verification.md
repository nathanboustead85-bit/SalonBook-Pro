# Phase 58.4 — Real Kotlin local runtime verification

This workflow uses Android Gradle Plugin 8.7.3, Gradle 8.9, Java 17 and Android SDK to **compile and run actual Kotlin JUnit tests** for the isolated `RecoveryPreviewValidator`. The local JVM test classpath includes the real `org.json` library, avoiding Android's unimplemented test stubs.

The tests exercise valid synthetic backup envelopes, unsupported versions, corrupted and non-array JSON, missing or oversized fields, duplicate/blank/missing booking IDs, and recovery of a subsequent valid preview after a rejection.

**Limitations:** These are local JVM tests, not instrumented Android-device tests. The helper is still not connected to `CloudActivity`; no SharedPreferences restore, process death, on-device rollback or production backup migration is verified. No user appointments are accessed. G1–G7 remain OPEN and live functionality/deployment remain disabled.

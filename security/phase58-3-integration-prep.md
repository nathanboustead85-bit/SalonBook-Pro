# Boustio Phase 58.3 — Android recovery integration preparation

A new **side-effect-free Kotlin** `RecoveryPreviewValidator` validates schema version 1, three JSON array fields, field-size limits and unique nonblank booking IDs. It returns an immutable preview snapshot. It has no Firebase or preferences access and is **not wired into the current app's backup or restore**.

The GitHub Actions workflow performs source-contract tests only. It **does not compile the Android app or run Kotlin/Android runtime tests**. On-device process-death recovery, Android SharedPreferences atomicity, rollback and real restore remain unverified. These must be tested with disposable synthetic appointments before any active integration.

The existing `CloudActivity` remains preview-only, and all seven launch blockers stay OPEN. No deployment or live feature enablement.

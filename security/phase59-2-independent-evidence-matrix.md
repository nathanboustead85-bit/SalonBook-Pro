# Phase 59.2 — Independent security evidence matrix

**No independent approval is claimed.** All G1–G7 gates remain OPEN. This document defines specific artifacts that a reviewer must inspect and sign off.

## Evidence workstreams
- **CHAT_AUTH:** Independent review of customer/business conversation isolation and Firestore authorization, including cross-tenant deny tests and staging verification.
- **CHAT_MEDIA:** Storage rules, photo upload validation, 60-second voice limits, quotas and abuse resistance.
- **CHAT_RUNTIME:** Actual customer-to-business messaging, notifications, retry and offline handling tested on two isolated accounts and a real Android device.
- **APK_IDENTITY:** Collect the installed 11.13 package ID, versionCode and signing certificate fingerprint, then compare with the newly built APK. The repository currently declares `com.salonbook.pro`, versionCode `2`, versionName `0.2.0`; these are **not** proof of installed APK identity.
- **APK_DATA:** Verify legacy booking parsing, disposable upgrades and rollback before requesting permission to upgrade the appointment-bearing app.
- **FIREBASE_STAGING:** Independent evidence of least privilege, project isolation, rules review and staging deny tests.

## Independent reviewer instructions
Each G1–G7 gate requires named reviewer, concrete staging evidence, risk disposition and dated signoff. CI success or a self-written checklist is **not** independent approval. A missing reviewer or missing evidence means OPEN. No gate is closed by this phase.

## Safe next actions
Implement missing chat features behind disabled-by-default staging controls; perform a non-destructive APK metadata and signing assessment; run disposable-device upgrade tests. Do not uninstall the user's 11.13 installation, clear app data, or activate live messaging, cloud restoration, payments or deployment.

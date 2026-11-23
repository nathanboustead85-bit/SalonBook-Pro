# Phase 59.1 — Independent security evidence gaps and release requirements

**Assessment only.** Independent approval has **not** been obtained. The seven launch gates remain **OPEN**.

## Required release outcomes

**Messaging:** Deliver actual real-time customer/business chat, 60-second voice messages, photos and notifications. Require independent verification of conversation authorization, message quotas, storage/media rules, attachment limits, abuse controls and staging end-to-end functionality. Current live messaging remains disabled. Existing isolated security tests are not equivalent to a working feature.

**Android upgrade:** The user's working 11.13 installation reportedly holds two original appointments. Current repository `app/build.gradle.kts` declares `applicationId = "com.salonbook.pro"`, `versionCode = 2` and `versionName = "0.2.0"`. **Do not assume** that this is the same package or a newer Android version than the installed 11.13 APK: the installed package identity, actual versionCode and signing certificate are unverified. No in-place upgrade is approved until identity, version monotonicity, signature compatibility, data migration, rollback and a disposable test have been verified. Do not uninstall, clear data or overwrite the appointment-bearing installation.

## Phase 59 evidence matrix

| Area | Evidence available | Evidence missing | Status |
|---|---|---|---|
| Seven launch gates | Offline consolidated gates file | Independent review and staging evidence per gate | OPEN |
| Android recovery | Phase 58 synthetic and source tests | Real Samsung disposable-process tests, crash-safe rollback | OPEN |
| Android APK upgrade | Repository build config | Installed APK identity, signing and version compatibility | OPEN |
| Live chat | Earlier messaging security foundations | Integrated chat, media, notifications, independent security verification | OPEN |
| Firebase security | Isolated candidate rules and emulator work | Independent review, staging isolation and approval | OPEN |
| Website/app release | Offline development and preview evidence | Controlled staging end-to-end and real-device signoff | OPEN |

## Next implementation priorities

1. Independently inspect the evidence needed to close G1–G7; no self-approval by CI.
2. Implement and test chat in a staging-isolated, disabled-by-default manner.
3. Establish the installed 11.13 APK package/signature/version facts before building a replacement.
4. Exercise the upgrade on disposable Android data, with a documented rollback path.
5. Integrate website, app, onboarding and messaging in controlled staging; keep deployment off until explicitly authorized.

No production Android data, Firestore rules or live features are changed in this phase.

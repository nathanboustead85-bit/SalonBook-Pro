# Phase 59.20 — Messaging engineering handover (NOT launch approval)

Phase 59 has delivered source-level browser demos, isolated Firebase emulator text and media foundations, server-side inbox projections and notification **candidates**. Phase 59.20 adds a machine-readable handover and automated safety assertions, including Android upgrade requirements.

## What has been verified
- Automated checks in previous successful GitHub Actions runs include Firestore/Storage emulator integrations, browser source checks, media validation, transaction idempotency and access controls.
- The Phase 59.20 workflow runs an independent consolidated source safety test and reruns Phase 59.19's actual Firestore emulator end-to-end text/inbox/notification-candidate tests.

## What has NOT been verified
- Real Firebase staging security, trusted token verification, business routing, authenticated website integration, media upload from browsers, push notification delivery, production readiness, Samsung microphone testing, and independent G1–G7 sign-off.
- Both browser messaging interfaces are offline previews. There is no live chat or notification delivery.
- All G1–G7 remain OPEN. Live bookings, payments, messaging and deployment stay disabled.

## Phase 60 Android data-preservation prerequisites
- Do **not** uninstall the older Android app, clear data, or overwrite its APK.
- Current repository `app/build.gradle.kts` declares `applicationId=com.salonbook.pro`, `versionCode=2`, `versionName=0.2.0`. The actual installed Android app's package, signing certificate and versionCode are **unknown**. User-facing label "11.13" is not proof of Android versionCode.
- Before a real upgrade: verify package ID, signing identity, current installed versionCode, backup/restore integrity, and that the two original appointments remain visible. First use a disposable, separately identified test APK on Samsung; only consider an in-place upgrade after documented device verification.
- No original Android data or Firebase production documents were accessed in Phase 59.20.

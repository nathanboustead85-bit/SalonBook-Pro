# Phase 60.12 — Safe Samsung in-place update test

This build uses the **same existing GitHub Actions signing secrets** as Phase 60.11, the same isolated Android package `com.salonbook.pro.isolated`, and increments versionCode from 4 to 5.

## Samsung acceptance procedure

1. Keep the currently installed **Boustio TEST Phase 60.11** app and the temporary saved **Boustio Test** client.
2. Download and extract the Phase 60.12 artifact from the successful GitHub Actions run.
3. Tap the APK and install it **directly over** Phase 60.11. **Do not uninstall or clear app data.**
4. Open Boustio TEST > Clients. Confirm the saved **Boustio Test** client is still present.
5. Close and reopen the app and confirm the client still appears.
6. If Android reports a package conflict, stop and report it. Never uninstall to force the test to pass.

This verifies on-device upgrade compatibility and client persistence; automated checks alone cannot prove either. Do not claim success until the user confirms. Original Boustio DEV 11.13 with two appointments remains untouched. All G1–G7 launch gates remain open; live bookings, payments, messaging and deployment remain disabled.

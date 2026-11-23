# Phase 60.10 — Samsung installation and data preservation

- Isolated Android test package remains `com.salonbook.pro.isolated`. Version code increased from 2 to 3 to support an in-place update.
- APK is built with standard GitHub Actions debug signing. A new runner may generate a **different debug signing key** from the previous runner. Therefore in-place installation **cannot be guaranteed** until a stable signing certificate is configured and verified against the currently installed APK. Never uninstall the user's current test app just to make the build install.
- Workflow prints the APK signing certificate SHA-256 for comparison and checks package/version, but does **not** claim the prior APK certificate matches.
- User should attempt installing over the current test APK. On an INSTALL_FAILED_UPDATE_INCOMPATIBLE or signature error, stop and share the error. Data-preserving migration or a stable signing strategy must be agreed before removing anything.
- Local contact records are not backed up by Firebase. A previous uninstall erased the test profile. The original DEV 11.13 APK with two appointments must never be uninstalled or cleared.
- Live bookings, payments, messaging and deployment remain disabled; all G1–G7 launch gates remain open.

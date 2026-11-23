# Phase 60.11 — Stable Boustio TEST signing and safe migration

## Why Samsung rejected Phase 60.10

Samsung showed "App not installed as package conflicts with an existing package." The leading explanation is a debug-signing certificate mismatch across GitHub-hosted builds. Package/version checks passed but do not prove that certificates match. A different certificate prevents an in-place update.

## Safe signing design

The Phase 60.11 workflow **fails closed** if any of four repository Actions secrets is absent; no APK is uploaded. The same test keystore must be retained and used on every future test build. Never commit keystores, passwords, base64 key material, or signing credentials to the repository, issue comments, chat, or screenshots.

Required GitHub repository secrets (Settings > Secrets and variables > Actions > New repository secret):

1. `SIGNING_KEYSTORE_BASE64`: Base64 of a newly generated, securely backed-up Android test keystore file.
2. `SIGNING_STORE_PASSWORD`: Keystore password.
3. `SIGNING_KEY_ALIAS`: Key alias in that keystore.
4. `SIGNING_KEY_PASSWORD`: Private-key password.

Reuse the previously created, backed-up `salonbook-release.jks` keystore with alias `salonbook`; do not generate or replace the existing signing key. Do not use a public web-based keystore generator or send the private key to the assistant. Back up the keystore and passwords securely; losing them will prevent future in-place updates to APKs signed with this certificate. After the secrets are configured, rerun the Phase 60.11 workflow. Its APK has versionCode 4 and the isolated package `com.salonbook.pro.isolated`.

## Migration of existing Phase 60.9 app

**Do not uninstall, clear storage, or overwrite the currently installed Boustio TEST app.** The Phase 60.11 key will be new and almost certainly cannot update the installed Phase 60.9 app, which was signed by an ephemeral GitHub runner debug key. Android will reject the new APK; this is expected and is not a reason to uninstall.

Before transitioning, preserve any locally saved clients/bookings via a tested export/import path or verified backup. This migration capability is not yet implemented in the isolated test app. If the current installation has no important test data, a one-time clean transition could be considered **only after the user explicitly confirms** the data loss. After a safe transition, future builds must use the exact same keystore and a strictly increasing versionCode.

Never modify or uninstall Boustio DEV 11.13; its two original appointments must be preserved. All G1–G7 launch blockers remain open. Live bookings, payments, messaging and deployment stay disabled.

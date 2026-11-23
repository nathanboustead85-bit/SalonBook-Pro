# Phase 60.1 — Isolated Samsung test APK (not an upgrade)

The `isolated` Android product flavor uses the distinct package `com.salonbook.pro.isolated`, app label **Boustio TEST**, a deliberately non-production demo Firebase configuration, and removes INTERNET/ACCESS_NETWORK_STATE permissions in its merged manifest. It disables Android backup for the disposable test variant. The original `standard` flavor retains package `com.salonbook.pro` and its existing Firebase configuration; no standard APK is built or uploaded in this workflow.

The Phase 60.1 GitHub workflow builds only `assembleIsolatedDebug`, verifies the final APK's package ID and permission manifest using `aapt`, and uploads it as an artifact. This APK is a separate installation, **not an in-place update**. It does not have access to the original app's local data and is not a test of preserving appointments during upgrade.

**Do not uninstall the original app, clear its data, or attempt an in-place replacement.** Its installed signing certificate, package ID and versionCode must be verified on Samsung first. The repository's `versionCode=2` is not proof of the installed versionCode. No production Firebase, real appointments, deployment, payments, bookings or messaging are enabled. All seven gates remain OPEN.

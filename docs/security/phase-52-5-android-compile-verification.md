# Phase 52.5 — Android compilation and backup safety verification

**Scope:** current development branch only. No Firebase access, APK installation, live booking, messaging, payment, App Check enforcement, IAM change or deployment.

The existing `android.yml` workflow targets main and builds an APK. Phase 52.5 instead adds a branch-compatible compilation workflow running `gradle --no-daemon :app:compileReleaseKotlin` plus source regression checks. It deliberately does not publish or install an APK.

**Important distinctions:** A successful source regression check does not prove Android compilation. A successful Kotlin compile does not prove Android runtime behavior or Firebase security. Compilation also does not prove an APK is ready to distribute. The tracked Android Firebase configuration refers to production; this workflow does not run the app or connect to Firebase.

**Backup risk:** `android:allowBackup="true"` is still present. This phase only detects and documents that fact, and does not alter backup settings or migration/recovery behavior. Cloud restore remains preview-only in this branch. The cloud backup-write action remains in source and needs further review before release.

**Safety:** The user's two original Android appointments are not accessed. All seven security blockers stay OPEN; PR #5 remains draft and unmerged. A failed build is a finding to fix, not permission to disable tests.

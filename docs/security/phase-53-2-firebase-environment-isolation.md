# Boustio Phase 53.2 — Fail-closed Firebase environment checks

**Finding:** The tracked `app/google-services.json` belongs to production Firebase project `salonbook-pro-ad5ff`, not the staging project `boustio-staging`. Existing Android build configuration has no staging flavor. Therefore a build made from the current source is **NOT** a staging build.

**Implemented:** `security/phase532-firebase-environment.cjs` verifies the expected project ID, exactly one Android client, package name and Firebase Android app ID syntax. GitHub Actions tests confirm that production config is rejected when labeled staging; synthetic staging config is accepted only when explicitly labeled staging. The staging CI gate requires a real `app/src/staging/google-services.json` and deliberately fails when it is absent or mismatched. No staging configuration is invented or committed.

**Critical limitation:** This is a configuration guard, **not yet complete build isolation**. No staging Android flavor, staging app registration, staging Google Services file or actual staging APK is configured. The default Android build still points at production. Before any real staging runtime testing, register the correct Android app in `boustio-staging`, add a separate application ID/build flavor and isolated Google Services file, validate generated resources, and prove staging cannot resolve production identifiers. Do not use the existing APK for staging tests.

**Safety:** No real Firebase access, deployment, APK installation, IAM/rules changes, App Check enforcement, live bookings/payments/messaging or PR merge. All seven launch gates OPEN. The two original Android appointments are untouched.

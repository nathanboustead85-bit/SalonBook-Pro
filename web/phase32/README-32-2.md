# Phase 32.2 — Isolated emulator environment validation

Static configuration validation only. This phase does not start Firebase emulators, initialize Firebase SDKs, connect to cloud staging, or deploy.

The demo-boustio-phase32-staging project ID is a local demo namespace, not a provisioned Firebase project. Firestore and Auth must use loopback-only distinct ports; emulator UI is disabled and single-project mode is required. Production aliases and credential-bearing environments are rejected.

Existing firebase.json and .firebaserc are unchanged. Production salonbook-pro-ad5ff must never be targeted. Real Firebase transaction and security rules tests remain pending.

The two original Android appointments are not accessed or modified. Live bookings, payments, messaging and deployment remain disabled.

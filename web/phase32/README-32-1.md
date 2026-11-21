# Phase 32.1 — Isolated Firebase staging preparation

**Preparation only: not a staging deployment.** This phase adds an offline, pure Node.js safety guard, synthetic configuration, tests and a read-only GitHub Actions workflow. No Firebase SDK is initialized; no credentials, network, migrations or live data are used.

## Existing production configuration
The repository's `.firebaserc` contains `default` and `production` aliases pointing at `salonbook-pro-ad5ff`. **Do not modify, use or deploy to this production project.** The existing `demo-boustio-migration` emulator alias is also reserved and must not be reused for this stage.

The `demo-boustio-phase32-staging` ID in the configuration is a **local placeholder for a Firebase emulator-style demo namespace**, not an actual provisioned cloud staging project. The guard rejects any non-`demo-` ID, project alias collisions, credential-bearing environment variables, and any enabled network, deployment, live booking, messaging or payment flags.

## Launch blockers and future work
- Real cloud staging requires separately approved provisioning and a dedicated project ID, security review and strict isolation. This phase does not create it.
- Real Firebase transaction concurrency, customer/owner authorization and Firestore rules must be verified before any live bookings.
- Authentication, App Check, quota and billing controls, recovery and privacy review are pending.
- The **two original Android appointments** are not accessed or changed; preserve and verify them before any future Android or migration work.
- No deployment, payments, messaging or live bookings are enabled.

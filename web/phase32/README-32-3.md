# Phase 32.3 — Actual isolated emulator smoke tests

GitHub Actions runs Firebase CLI **emulators:exec** for **Firestore and Authentication only**, with an explicit `demo-boustio-phase32-staging` project ID and a separate emulator configuration file. This starts local processes on the temporary GitHub Actions runner; it is **not a cloud Firebase project**.

The dedicated Firestore rules file denies every read and write. Runtime smoke tests verify Firestore refuses anonymous reads and writes and the Auth emulator responds with an empty synthetic account list. The workflow does not load repository production rules, use production aliases, connect to production Firebase, run migrations, or deploy. The emulator is stopped after tests.

The **two original Android appointments** are not accessed, imported or modified. Live bookings, payments, messaging and deployment remain disabled. These smoke tests do **not** establish real Firebase booking transaction safety or authorize a production launch.

The Firebase CLI download and Java setup in GitHub Actions use the runner's standard package sources, not Firebase cloud project credentials.

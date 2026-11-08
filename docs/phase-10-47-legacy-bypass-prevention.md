# Phase 10.47 — Legacy prototype bypass prevention

**Status: emulator-only default-deny hardening; production HOLD.**

Both `phase1040EmulatorLockedInitialization.js` and `phase1041EmulatorApprovalIssuance.js` now fail closed when `BOUSTIO_LEGACY_EMULATOR_TEST_GATE` is not exactly `explicit-test-only`. Their original demo-project/Firestore-emulator restrictions and disabled-by-default execution flag remain. The CI workflow sets this flag **only** on the historical Phase 10.40, 10.41, 10.42, 10.43 and 10.46 emulator test steps, rather than job-wide. Phase 10.47 tests assert the default-deny behaviour, non-demo lock, execution flag and no exports from `functions/index.js`.

**Important limitation:** An environment variable is **not** a secure authority or unforgeable capability. Anyone able to execute arbitrary code with control over the process environment could set this test gate and directly call the legacy modules with fake callbacks. This is an accidental-exposure safeguard, **not** complete prevention of a malicious internal caller. A future production implementation must remove or make inaccessible the injectable legacy exports, with a non-injectable trusted boundary and independently reviewed operator controls. Do not set the gate in production or deploy these modules.

The Phase 10.46 orchestrator still invokes legacy modules internally and therefore its emulator tests require the test-only gate. No production execution has been authorised.

No production Firebase writes, deployments, booking deletion, freezing or public booking activation.

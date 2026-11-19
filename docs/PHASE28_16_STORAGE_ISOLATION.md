# Phase 28.16 — Storage isolation and abuse-prevention contract

**Status: staging-only policy, NOT a working upload service.** The standalone `tests/phase28_16.storage.rules` denies every client read/write. It is deliberately **not referenced by firebase.json** and has not been deployed. Existing bookings and Phase 28.13 website are unchanged.

`functions/phase2816StoragePolicy.js` simulates checks for verified ownership, matching business/owner/path, App Check, source type and signature, 8 MiB size, daily attempt limit 30, pending-object cap 12, and atomic quota reservation. It defaults to blocked outside `isolated-test`. Publication simulation additionally requires review, scan, EXIF removal, re-encoding, ownership recheck and committed quota.

**Important limitations:** JavaScript policy simulations do not prove Firebase Storage rule behavior, concurrency, real App Check verification, signature inspection, actual quotas, or real processing. No client upload is permitted even when simulated preflight succeeds. Trusted Admin SDK bypasses Storage rules; backend enforcement remains a mandatory launch blocker. Future work: real emulator rule tests, authenticated upload initiation, transaction-backed quota, processor, storage lifecycle and billing alerts, before any live activation.

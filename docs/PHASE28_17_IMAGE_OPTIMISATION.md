# Phase 28.17 — Isolated image optimisation engine

Implemented a **real Sharp-compatible processing function** with a supplied/injected Sharp dependency. It checks file signatures, MIME type, decoded dimensions and animation; decodes pixels; applies EXIF orientation with `rotate()`; crops to bounded service (1200×900), staff (800×800), or cover (1600×900) dimensions; re-encodes as WebP quality 76; verifies the processed file is ≤2 MiB and that EXIF/XMP/IPTC/ICC metadata is absent. Sources must be ≤8 MiB. No uploaded files or cloud credentials are accessed.

**Important:** CI tests use an injected mock Sharp interface and verify control flow and safeguards; they do **not** establish image quality, performance or metadata removal on real photos. Real fixture-based Sharp integration tests, malicious image corpus, file signature scanning, storage lifecycle, moderation, billing budgets and backend integration are still required before deployment.

This module is intentionally not connected to Firebase Storage, the booking website, Android, or any production callable. It defaults to disabled, only accepts `isolated-test` mode and never writes files. Existing bookings and the approved photographic demo are unchanged.

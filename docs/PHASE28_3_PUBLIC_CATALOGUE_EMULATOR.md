# Phase 28.3 — Real Firestore emulator public catalogue security

Run `tests/phase28_3_public_catalogue_emulator.test.cjs` using the real Firebase Firestore rules emulator, isolated under `demo-boustio-phase283`. The tests seed synthetic publicBusinesses documents with security rules disabled (representing trusted server publication), then exercise actual client SDK reads under deployed-repository `firestore.rules` in the emulator.

Covers anonymous published-document reads; unpublished get denial; collection list/query denial; client writes denial; private client/appointment reads denial; distinct businesses; slug-to-document mismatch rejection; missing mappings; private data stripping; and disabled booking writes.

**Boundaries:** The test provides a synthetic server-verified mapping function; no real trusted slug mapping endpoint is installed. It does not access production Firebase, use production credentials, deploy Firestore rules, or enable live booking or messaging. The preview UI still uses fictional data; a real staging page is future work. Existing appointments are untouched.

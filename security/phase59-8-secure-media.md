# Phase 59.8 — Secure photo and voice validation foundation

Implemented `chat/media-validation.cjs`: actual byte-signature inspection, declared-vs-detected MIME matching, 5 MiB image and 10 MiB audio caps, trusted image decoder requirement, trusted voice duration probe requirement (max 60 seconds), cryptographic SHA-256 digest and random server-generated staging storage path. The module **fails closed** if the decoder or duration probe is missing. Tests use injected synthetic probes; they do not prove real decoding or audio duration parsing.

**Outstanding before accepting real media:** Implement sandboxed actual image decoding and re-encoding (strip EXIF/metadata), malware scanning, a trusted audio parser and duration verification, per-user quotas and moderation, content type and object integrity checks, authenticated upload sessions, Storage rules, expiration/retention/deletion, ownership-bound download URLs and independent security testing. Signature checks alone are insufficient to authenticate media. The generated storage path is not written anywhere in this phase.

No live media upload, Firebase Storage deployment, public endpoint, notifications or Android changes were performed. G1–G7 remain OPEN. Original appointments are untouched.

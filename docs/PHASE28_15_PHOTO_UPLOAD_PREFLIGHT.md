# Phase 28.15 — Isolated photo upload preflight

This is an **offline policy simulation**, not a functioning upload system. No callable endpoints, Firebase Storage rules, cloud buckets, uploads, image-processing services or deployments are added. The approved photographic booking preview and existing appointments are untouched.

The proposed preflight requires verified business owner identity, verified App Check, matching business and subject IDs, source JPEG/PNG/WebP/AVIF up to 8 MiB, valid image dimensions, valid alt text, and simulated per-day and per-business limits. It defaults to disabled and explicitly blocks all environments other than `isolated-test`. Proposed caps: 30 attempts/day, 12 accepted/day, 21 images/business; processed WebP/AVIF up to 2 MiB.

The simulated publication gate requires server-side review, malware scanning, content approval, EXIF stripping and image re-encoding. These requirements are **not implemented** and the simulation cannot prove they occurred in real infrastructure. The returned paths are proposals, not write permissions or URLs.

Before real uploads: implement trusted server-side owner resolution and transactionally enforced quotas, secure Storage rules and bucket setup, content signatures and actual processing pipeline, moderation, lifecycle deletion, App Check attestation, abuse monitoring, billing alerts, concurrency tests, and an explicit deployment approval.

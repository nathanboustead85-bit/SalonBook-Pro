# Phase 28.14 — Business-owned photo contract (offline only)

Approved visual direction: premium teal-and-white booking page with photographic service cards.

This phase introduces a **pure read-only image metadata validation contract** for future service, staff and cover photography. It does not upload files, write storage, deploy, change Firestore rules, enable real bookings, or alter the approved Phase 28.13 demo.

Only public, approved, processed WebP/AVIF images with a business/owner-scoped relative media path are eligible. Images are associated with allowlisted service/staff IDs, with a maximum of 12 service photos, 8 staff photos, one cover, and 2 MiB per processed file. The gallery safely falls back to no image.

**Important:** These are proposed display-side limits, **not enforced cloud quotas**. The backend must later enforce business ownership, auth, App Check where appropriate, file signature checks, malware scanning, image conversion, content moderation, signed or trusted serving, upload rate limits, storage budgets, deletion and retention. The current relative URL is a proposed contract and is not yet served by a backend.

The Phase 28.13 photo concept remains an illustrative Unsplash-based demonstration. It is not a verified business-owned gallery.

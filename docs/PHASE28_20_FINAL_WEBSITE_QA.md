# Boustio Phase 28.20 — Final website QA and polish checkpoint

## Scope
This phase adds a CI quality gate covering the premium booking preview, opt-in photographic booking preview, business photo-manager demo, and staff portfolio/salon gallery demo. It runs automated static checks and the Phase 28.17–28.19 regression suites and packages **standalone owner-manager and portfolio previews** for Samsung download.

## Quality checks
- Mobile viewport, mobile CSS breakpoints, semantic main/headings, descriptive titles, no-index directives.
- Local relative CSS/JS paths, safe DOM rendering, accessible status feedback and category/staff selection.
- No enabled booking confirmation or photo upload controls.
- No network/persistent storage access in owner photo-manager and portfolio demo scripts.
- Cross-owner gallery isolation and photo-management regressions.
- Phase 28.17 image optimisation unit tests (mocked Sharp adapter, **not real image fixture processing**).

## Manual Samsung sign-off — still required
Open both HTML previews in Samsung Internet after extracting the artifact. Test portrait and landscape, keyboard navigation if available, 200% text scaling, focus indicators, button sizes, category filters, portfolio selection, empty states, remove/reorder/reset demo behavior, and whether content clips or overlaps. Verify nothing persists after refresh. Capture screenshots and note any visual issues.

The customer booking/photo previews require their original dependency tree; this artifact does not claim to package a working standalone customer booking preview. Reuse the Phase 28.12 browser/screenshot workflow or a complete source checkout for that review.

## Launch blockers — not completed by this phase
Real business-owned photo upload and storage emulator rules; actual Sharp processing with representative image fixtures; moderation/rights and consent; authenticated owner management; App Check and quotas; production booking/payment/messaging security and end-to-end tests; cross-device visual/accessibility review; production configuration and explicit deployment authorization.

**Phase 28's provisional 20-part preview roadmap can finish after CI and manual sign-off, but Boustio is not launch-ready.** This phase does not deploy or alter existing appointments.

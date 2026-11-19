# Phase 24.9 — Unified synthetic business onboarding

A premium teal-and-white, mobile-responsive, read-only setup navigator integrating the existing Phase 24.3–24.8 synthetic draft modules. It shows five setup sections: business profile, services, staff, branding and booking preferences. Progress counts validated saved sections: a profile must pass the existing profile completeness checks, services and staff need at least one item, and branding/preferences need validated saved drafts. This is a demonstration completion heuristic, **not launch eligibility**.

Section navigation saves only the active section in owner-scoped sessionStorage. It restores the last section after reload, offers refresh of existing validated drafts, and allows resetting navigation without deleting business drafts. Invalid draft recovery is isolated and reported. Dashboard and setup navigation do not change any business draft.

The existing older files `tests/fixtures/phase24_onboarding.html` and `tests/phase24_onboarding_entry.mjs` belong to an earlier demo and are intentionally left unchanged; Phase 24.9 uses uniquely named integrated setup fixtures.

Automated Node tests, real Chromium mobile/desktop/keyboard tests, and isolated Firebase Auth/Firestore emulator denial checks run in a dedicated GitHub Actions workflow. No production Firebase changes, deployments, Android appointment changes or live registration, booking, payment or publishing.

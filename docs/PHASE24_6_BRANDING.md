# Phase 24.6 — Premium business branding

Synthetic demonstration of business logo and cover photo selection (PNG, JPEG or WebP, maximum 350 KB each), controlled brand palette, name/tagline and a personalised teal-and-white customer booking-page preview. Images are local data URLs in browser sessionStorage, not uploaded or published. Session storage is **not secure authenticated storage** and browser users can alter it. Input validation includes image signatures, MIME, length and palette checks; browser preview uses safe DOM text assignment.

30 automated tests include real Chromium at Samsung/desktop widths, uploads, preview, recovery, XSS-safe rendering, no outbound requests, and anonymous/cross-owner Firestore denial in isolated emulators. Production rules, Android data and cloud configuration are unchanged. No deployment.

Real registration, customer bookings, payments and publishing remain disabled. The preview is not a working customer booking page.

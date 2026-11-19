# Phase 26.3 — Backend and publishing security audit

This milestone adds **read-only source-contract checks and isolated Firestore emulator tests**. It does **not** invoke Cloud Functions or simulate callable HTTP requests. Consequently, source checks are not proof of runtime authorization.

## Scope and evidence
- Review `functions/index.js` callable exports `publishBusiness`, `unpublishBusiness`, `publishPublicCatalogue`, `sendBusinessChatReply`, and `inspectLegacyBookingMigration`.
- Check that publication derives business identity from a verified Firebase user, reads the owner's private profile, validates the profile and slug ownership, and keeps `acceptingBookings: false`.
- Check that unpublishing targets the verified owner's public profile, disables publication and bookings, and calls the slug mapping helper.
- Check catalogue publication rejects client-supplied catalogue data; inspect owner-only chat reply and its disabled-by-default environment gate.
- Test anonymous, cross-owner, unverified and verified owner client SDK permissions against local Firestore rules. Test denial of direct public publication/unpublication and backend-only document writes.

## Risks and explicit launch blockers
1. **Existing publishing functions are implemented and may already be deployed**. This audit neither disables deployed endpoints nor verifies production state. Obtain explicit authorization before changing deployed functions or IAM.
2. **App Check enforcement is currently false** on inspected callable exports. Before enabling live features, establish appropriate App Check and rate-limiting controls.
3. Firebase Admin SDK bypasses Firestore rules. Client emulator tests **cannot** establish callable authorization. Add isolated callable-runtime tests with mocked Firebase Admin and verified request contexts, plus negative cases for unauthenticated, unverified, cross-owner and slug-collision requests.
4. Check publication of business phone/address/description for privacy and consent; review public HTTP handler and catalogue exposure.
5. No live booking or payment functionality is enabled by this change. Customer messaging remains disabled by environment gate; voice/media requires separate security work.

## Safety
Uses `demo-boustio-phase263`, localhost Auth/Firestore emulators, no service credentials, no deployment steps, no Android changes, and no production appointments or payments.

# Phase 31.2 — Repository schema inspection and safe mapping

Reviewed actual files on branch `milestone-customer-booking-experience`:

- `firestore.rules`: `/users/{userId}/liveData/{dataType}` supports **verified-owner reads** for `bookings`, `services`, `staff`. Stored shape is `json` string, `schemaVersion: 1`, `updatedAt` timestamp. This is **private** and must not be read by a public booking browser.
- `/users/{userId}/business/profile` is verified-owner only and includes private email, phone and address. Do not expose it as a public document.
- `/publicBusinesses/{businessId}` permits individual reads only when published, prohibits listing and all client writes. Existing `web/phase1239/catalogueAdapter.js` expects `businessId,name,slug,category,published:true,acceptingBookings:false,schemaVersion:1` and explicitly returns **profile only**, not services.
- `web/phase1280/catalogueContract.js` validates an **already-authorized published catalogue** `schemaVersion:1,slug,published:true,businessName,services,staff`; it is a display-only contract, **not proof** that a Firestore public catalogue collection exists.
- `web/phase1279/publishedProfileAdapter.js` validates published display profiles and filters unpublished services and inactive staff.
- `functions/publicAvailabilityProjection.js` contains a pure public-safe availability projection and freshness reader. This is not evidence of a deployed publication endpoint.

## Phase 31.2 boundary

`business-data-mapper-31-2.js` combines the existing public-profile adapter and published catalogue contract, verifies **same business ID, slug, business name**, requires `acceptingBookings:false`, and returns a strict public display allowlist. No customer details, private contact fields, appointment records, owner records, working hours or internal JSON blobs are returned. Missing or mismatched data **fails closed**. Output is deeply frozen and explicitly disables bookings and live availability.

The Phase 31.1 fixture schema is a staging contract, **not** the verified Firestore schema. No automatic conversion of private `liveData` JSON to public records is attempted.

## Outstanding blockers

An authorized, owner-controlled publication pipeline and actual deployed public catalogue schema have **not been established** by these inspected sources. Do not claim live Firestore integration. A future phase must inspect the real data writers, authentication and publication endpoint and test emulator security before connecting any reads. No Firestore rules, Android code, customer appointments or deployment changed.

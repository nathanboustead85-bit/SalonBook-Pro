# Historical booking backend review

Source branch: phase-12-19-booking-reliability

- functions/trustedBooking.js blob deceea939f431f8162beeea8ac9af10f5c8ce833
- functions/bookingEngine.js blob f54aede3a0767c414b0bb497fe9c575ca97c4172
- functions/trustedCatalogue.js blob e499e90f5334180d3d95784424ed92c09267c775

Existing engine creates appointments and all overlapping 15-minute staff locks in one Firestore transaction. Trusted catalogue supplies price, duration, staff assignment, working hours, breaks and time off. Public business and catalogue checks precede transaction, so publication and schedule changes can race. No idempotency key, caller authorization, expected revision or cancellation/rescheduling in these three modules. UK local time only; DST ambiguity unresolved. Legacy Android records must be migrated into the same lock system before activation. Catalogue path businesses/{businessId}/catalogue/current is reserved; publishing adapter unverified. Retain existing owner guards and legacy migration protections. Recover and adapt internal modules in later phases with emulator tests, not by deploying historical functions. This is a scoped source review, not full backend certification.

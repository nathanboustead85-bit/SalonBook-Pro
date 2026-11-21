# Phase 32.5 — Multi-owner isolation, forged ownership, and unauthorised writes

Runs the existing repository `firestore.rules` in the isolated demo Firebase Firestore/Auth emulators. Three fictional business owners are seeded with synthetic profiles, appointments, services, conversations, backup and booking-request records. The suite verifies each owner can access permitted own records, while simultaneous cross-owner reads and writes fail. It checks forged `businessId`, unapproved fields, booking enablement, unauthorised updates/deletes, unverified accounts, anonymous reads and collection listing. A legitimate verified-owner name update is a positive control.

The test uses local loopback ports and the `demo-boustio-phase32-staging` ID. No cloud project, production data, live appointments, payments, messaging, or deployment is accessed or enabled. Existing production rules and Android appointments are not edited.

This is Firestore rules testing with synthetic auth claims, not proof that backend endpoints, token issuance or real-world concurrency are secure.

# Phase 32.4 — Real Firestore security rules in isolated emulators

This workflow runs the **existing repository firestore.rules** in a temporary local Firestore emulator, using the explicit demo project ID `demo-boustio-phase32-staging`. Authentication emulator also starts; `@firebase/rules-unit-testing` supplies synthetic verified/unverified owner claims to exercise actual Firestore rules without real credentials or production users.

Checks include private business profiles, verified email requirements, cross-owner isolation, private appointments, conversations, live services, legacy backup owner-only behavior, server-only booking reservations, public directory access, and rejection of profile writes that enable bookings. All seeded records are synthetic and created only inside the temporary emulator.

The existing production rules are **tested, not edited or deployed**. No real customer data, Android appointments, payments, messaging, or live booking operations are accessed. The two original Android appointments remain outside this workflow.

This is a rules-focused test, not proof of production backend authorization, real email verification delivery, or complete launch readiness.

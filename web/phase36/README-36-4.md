# Phase 36.4 — Secure read-only dashboard session presentation

`createSecureDashboardSession` composes Phase 36.3 verified Firebase Auth listener with the Phase 36.2 owner-session gate and Phase 36.1 read-only Firestore adapter. It projects signed-out, loading, ready, unavailable and recovery states without retaining any prior business data when the underlying session is invalid. Manual retry and network restoration require fresh token verification and atomic Firestore reads.

All projected states explicitly disable booking, editing, payments and messaging. No actual browser UI or Android activity is wired; this is a dependency-injected presentation-state module. The emulator tests use synthetic Auth accounts and real Firestore security rules with rules-unit-testing contexts, not a real Auth ID token bound to the Firestore client. No production data, live Firebase initialization, writes, deployment or changes to production Firebase rules/config.

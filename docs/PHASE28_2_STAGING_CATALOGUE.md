# Phase 28.2 — Read-only staging catalogue integration

This phase adds `web/phase28/stagingCatalogue.js`, a **read-only adapter** connecting the premium Phase 28.1 preview model to the existing Phase 13.6 trusted slug resolver and Phase 13.5 public directory contract. The adapter requires two externally supplied capabilities: a **server-verified slug-to-businessId lookup** and an **authorized get-only Firestore reader** for `publicBusinesses/{businessId}`. No collection listing, owner/private reads, customer writes, booking creation, messaging, or deployment are performed.

The integration rejects missing readers, invalid/mismatched/unpublished mappings, invalid public documents, missing services, malformed fields, and exceptions. Only an allowlisted set of published public fields is handed to the premium page model. The result always sets `bookingEnabled:false`.

**Not yet connected to real Firebase:** no staging credentials, real Firestore SDK bootstrap, trusted mapping endpoint, or production configuration is installed. The tests exercise the integration contract with simulated authorized readers, not live staging access. The current `web/phase28/index.html` remains a fictional demonstration; a future separately gated staging page can consume this adapter once the trusted reader and security rules are verified. Preserve original appointments. No production deploy.

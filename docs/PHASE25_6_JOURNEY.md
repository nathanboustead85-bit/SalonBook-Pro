# Phase 25.6 — Synthetic customer booking journey

Adds an in-memory, read-only selection and review journey: service, assigned professional, date, illustrative time, price and booking summary. A time can be selected only if Phase 25.5 synthetic reliability and Phase 25.4 buffer-aware conflict filtering still report that exact slot. The summary is labelled **DEMO ONLY — NOT BOOKED**, and confirmation is explicitly disabled. Selection is not written to storage and disappears on reload. No customer personal data is collected.

No real customer booking, registration, payments, publishing, production Firestore access, Android data access or deployment. Fictional demo records only. Browser tests cover mobile/desktop, keyboard, summary, clearing, reload and disabled actions. Isolated Firebase Auth/Firestore emulator tests verify synthetic journey documents cannot be read/written by anonymous or other-owner contexts.

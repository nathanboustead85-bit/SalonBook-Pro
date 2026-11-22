# Boustio Phase 41.4 — Isolated multi-device dashboard recovery

Per-device, read-only dashboard coordinators use the Phase 41.3 atomic Android v1 reader and validate every refresh. Request epochs and owner identity fence delayed reads during concurrent refreshes, account switches, sign-out and stop. Offline clears business data immediately; reconnect performs a fresh read and rejects malformed data. No cached business data is restored without revalidation.

Firebase emulator tests seed synthetic owner A/B documents exclusively within the emulator, verify rules-based owner isolation and check two clients and reconnect. Android v1 has no shared revision, so these tests **do not prove cross-device consistency** or authorize live bookings. No real-time listener, production Firebase SDK initialization, migrations or deployment are added. All Phase 40.5 P0 blockers remain open. Original Android appointments are never accessed or modified.

# Phase 20.8 — Automatic recovery and connection monitoring

**Release decision: NO-GO.** Not connected to the production website.

Added an opt-in, dependency-injected dashboard connection monitor:
- Subscribes to connectivity changes and dashboard status updates.
- Clears private data and cancels scheduled work on offline transitions.
- Attempts to reattach only the currently authenticated user.
- Uses bounded exponential retry delays, a maximum attempt count and a fail-closed exhausted state.
- Stops retries when fresh dashboard data arrives; avoids redundant work on duplicate connectivity events.
- Clears pending timers and private state on stop.
- Uses injected timers and events for deterministic automated tests; no production network or Firebase calls.

The Phase 20 Firebase emulator GitHub Actions workflow now includes six new connection-monitor tests alongside the prior 27.

Limitations: These tests simulate connectivity/status callbacks. Actual browser connectivity event wiring, real Firebase SDK listener error integration, network reachability checks and full device recovery remain future tasks. No deployment, registration, customer bookings, or Android appointment changes. **GitHub Actions must pass before this phase is verified.**

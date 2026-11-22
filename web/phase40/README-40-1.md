# Boustio Phase 40.1 — Source-grounded dashboard integration readiness assessment

## Evidence inspected (development branch)
- `web/phase39/unified-session-39-2.js`: injected auth.currentUser, forced token refresh, generation fencing. No browser auth observer, revocation backend verification or real SDK wiring.
- `web/phase39/dashboard-view-model-39-3.js`: isolated presentation states and subscriptions, but no DOM, browser mount/unmount, focus management or screen-reader evidence.
- `web/phase39/android-compatibility-39-4.js`: Android v1 staff hours and breaks, but explicitly `businessOpeningHoursStatus: NOT_VERIFIED`, `sharedRevisionVerified: false`, `migrationReady: false`.
- `web/phase39/final-audit-39-5.js`: static source-boundary checks; not a penetration test.
- `web/phase39/README-39-5.md`: prior Phase 40 plan and explicit non-launch verdict.

## Findings and risk priorities
**P0** Browser observer lifecycle remains unconnected to the isolated session and dashboard. Stale results, auth refresh rejection, cross-owner transitions and teardown need browser integration evidence. The Phase 39 view-model projects a minimal read-only label set, not a production UI.

**P0** Production token revocation and App Check not verified. Injected token claims are synthetic; Firebase emulator coverage cannot establish production authorization.

**P0** Android staff weekly schedule is not verified business-wide opening hours. Three separate Android documents have timestamps but no proven shared revision or migration/rollback contract. The two original appointments must not be used as migration fixtures.

**P0** Real Samsung browser accessibility, offline/reconnect, staging isolation, logging/privacy, deployment rollback and operational approval remain outstanding.

## Prioritised implementation plan
1. **40.2 — P0:** Build isolated browser auth observer and mount/unmount adapter with a safe DOM view, Playwright tests, account-switch, sign-out and stale-response checks; no public route.
2. **40.3 — P0:** Define explicit business-wide opening-hours and shared revision contract with negative emulator validation; never infer availability from staff hours.
3. **40.4 — P0:** Exercise auth refresh/revocation failures, offline/reconnect, concurrent owner switching and observer teardown; keep fail-closed states.
4. **40.5 — P0:** Complete integrated isolated browser/emulator audit, evidence checklist, staging manual test plan and blocker register; no launch approval.
5. **Later — P0/P1:** Independent production security/App Check, Android appointment backup and migration rollback approval, Samsung accessibility, business onboarding, privacy and operational readiness.
6. **Later — P2:** Only with separate explicit approval: live bookings, payments, messaging, customer UX launch and deployment.

## Safety and limitations
This phase adds isolated negative unit regression and source-boundary checks. It does **not** initialize production Firebase, modify rules, read original appointments, migrate data, enable live features, mount a public dashboard or deploy. Passing CI proves only the tests exercised in CI. `assessReadiness()` always returns `productionReady:false`.

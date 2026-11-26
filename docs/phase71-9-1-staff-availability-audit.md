# Staff availability parity audit

Current Android ManagementActivity stores staff name, role and free-text hours. It does not expose structured weekly availability, breaks, leave, exceptions or service assignments. Earlier implementation/schema has not been located; do not assume compatibility.

Recovery gates: locate canonical availability schema and booking validator; map legacy records without overwriting hours; implement weekday/time controls, copy days, breaks, holiday ranges, absence and exceptions, service assignment; validate booking duration and conflicts against availability; test migration, existing bookings, overlapping leave, boundaries and cross-device parity. Keep live features disabled. Do not deploy. Phase 71.9 physical verification remains incomplete.

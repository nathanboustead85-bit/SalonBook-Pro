# Phase 60.8 — Local client profile management

Added a non-exported Android ClientActivity with premium Boustio styling and a separate `client_records_v1` JSON array in existing local SharedPreferences. Features: add/edit client name, optional phone/email/notes, search by name, validation, duplicate-name prevention, explicit save-result handling, and delete confirmation. Deletion is blocked when existing booking records reference the client's name, and fails closed if booking history cannot be parsed. No migration or rewriting of the `bookings` key is performed.

**Limitations:** The new independent client records and booking-derived client list are not yet unified into one screen; Clients tab provides access to the separate client manager plus booking history. Contact profiles are local-only, not encrypted beyond Android app sandbox, not synced to Firebase, and not backed up by the cloud feature. Client names are used as the matching key for booking history, not a stable client ID. Do not store sensitive health or financial notes in this test build.

The isolated test package must not overwrite Boustio DEV 11.13 or its two original appointments. Live bookings, payments, messaging and deployment remain disabled; all G1–G7 launch gates remain OPEN.

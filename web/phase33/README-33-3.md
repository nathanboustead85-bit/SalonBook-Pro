# Phase 33.3 — Read-only staff data compatibility

Based on inspected Android `ManagementActivity.kt`: staff records have `id`, `name`, `role`, `serviceIds`, `weeklySchedule` (weekday to `{open,close}`), `weeklyBreaks` (`id,day,start,end,reason`), `timeOff` (`id,date,start,end,reason`), and `publicVisible`. Android cloud sync stores the staff array under `users/{uid}/liveData/staff`.

This offline adapter validates staff profiles, assigned service IDs against validated services, weekly hours, breaks, and time-off. It discards free-text reason notes from the dashboard preview, keeps visibility private by default, freezes results and rejects stale or mismatched owner/revision inputs. It never computes live appointment availability.

No Firebase SDK, production dashboard, booking action, payment, messaging, deployment, or Android storage changes are made. Older legacy `hours` strings are not interpreted: missing weekly schedules yield no verified hours, rather than guessed availability. Integration with authenticated server-fresh Firestore reads is a future phase.

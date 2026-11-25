package com.salonbook.pro

import java.security.MessageDigest

/** In-memory offline schedule projection. No delivery, alarms or durable queue. */
internal class ReminderSchedulePreview {
    data class Event(val id: String, val window: AutomaticReminderPlan.Window)
    private data class Key(val owner: String, val booking: String)
    private data class Entry(val revision: Long, val snapshot: SecureReminderPlan.Snapshot, val events: List<Event>)
    private val entries = mutableMapOf<Key, Entry>()

    @Synchronized fun reconcile(candidate: SecureReminderPlan.Snapshot?, current: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, now: Long): List<Event> {
        if (current == null || candidate != current || now <= 0L || !NotificationPrivacyPolicy.authorized(current.booking, owner, requested)) return emptyList()
        val booking = current.booking
        val key = Key(booking.businessId, booking.bookingId)
        val previous = entries[key]
        if (previous != null && (booking.revision < previous.revision || (booking.revision == previous.revision && current != previous.snapshot))) return emptyList()
        val events = SecureReminderPlan.windows(candidate, current, owner, requested, consent, settings, now).map { window ->
            val parts = listOf(key.owner, key.booking, booking.revision.toString(), current.appointmentAtMillis.toString(), window.type.name)
            val canonical = parts.joinToString("") { "${it.length}:$it" }
            val id = MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
            Event(id, window)
        }
        entries[key] = Entry(booking.revision, current, events)
        return events.toList()
    }
    @Synchronized fun count(): Int = entries.values.sumOf { it.events.size }
}

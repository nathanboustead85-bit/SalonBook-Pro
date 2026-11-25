package com.salonbook.pro

/** In-memory preview deduplication only; not a durable delivery ledger. */
internal class ReminderPreviewLedger {
    private data class Key(val businessId: String, val bookingId: String, val revision: Long, val event: String)
    private val seen = mutableSetOf<Key>()

    @Synchronized
    fun claimPreview(
        candidate: NotificationSafetyPolicy.BookingSnapshot?,
        current: NotificationSafetyPolicy.BookingSnapshot?,
        expectedBusinessId: String,
        event: String,
        eligible: Boolean
    ): Boolean {
        if (!eligible || candidate == null || current == null) return false
        if (expectedBusinessId.isBlank() || current.businessId != expectedBusinessId ||
            current.bookingId.isBlank() || current.revision <= 0L ||
            !current.confirmed || current.canceled || !current.emailConsent ||
            !current.businessEmailEnabled || current.email.isNullOrBlank()) return false
        if (candidate != current) return false
        if (event !in setOf("reminder-24h", "reminder-2h")) return false
        return seen.add(Key(current.businessId, current.bookingId, current.revision, event))
    }
}

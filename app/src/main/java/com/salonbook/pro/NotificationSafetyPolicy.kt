package com.salonbook.pro

/**
 * Phase 62.1: fail-closed, offline-only notification policy foundation.
 * No network, scheduler, delivery, WhatsApp launch or persisted settings.
 */
internal object NotificationSafetyPolicy {
    const val LIVE_EMAIL_ENABLED = false
    const val LIVE_WHATSAPP_ENABLED = false
    const val LIVE_BOOKING_ENABLED = false

    data class BookingSnapshot(
        val businessId: String,
        val bookingId: String,
        val revision: Long,
        val confirmed: Boolean,
        val canceled: Boolean,
        val email: String?,
        val emailConsent: Boolean,
        val businessEmailEnabled: Boolean
    )

    fun mayQueueEmail(snapshot: BookingSnapshot?, expectedBusinessId: String): Boolean {
        if (!LIVE_EMAIL_ENABLED || snapshot == null) return false
        return snapshot.businessId.isNotBlank() &&
            snapshot.businessId == expectedBusinessId &&
            snapshot.bookingId.isNotBlank() &&
            snapshot.revision > 0 &&
            snapshot.confirmed &&
            !snapshot.canceled &&
            snapshot.emailConsent &&
            snapshot.businessEmailEnabled &&
            !snapshot.email.isNullOrBlank()
    }

    fun idempotencyKey(businessId: String, bookingId: String, revision: Long, event: String): String? {
        if (businessId.isBlank() || bookingId.isBlank() || revision <= 0L ||
            event !in setOf("confirmed", "rescheduled", "canceled", "reminder-24h", "reminder-2h")) return null
        return listOf(businessId, bookingId, revision.toString(), event).joinToString(":")
    }
}

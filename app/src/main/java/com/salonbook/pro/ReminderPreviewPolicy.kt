package com.salonbook.pro

/** Offline eligibility only. Never schedules or sends communications. */
internal object ReminderPreviewPolicy {
    fun eligible(
        booking: NotificationSafetyPolicy.BookingSnapshot?,
        expectedBusinessId: String,
        customerId: String,
        consent: NotificationPreferences.CustomerConsent?,
        settings: NotificationPreferences.BusinessSettings,
        type: NotificationPreferences.ReminderType,
        appointmentAtMillis: Long,
        nowMillis: Long
    ): Boolean {
        if (booking == null || consent == null) return false
        if (expectedBusinessId.isBlank() || booking.businessId != expectedBusinessId ||
            booking.bookingId.isBlank() || booking.revision <= 0L ||
            !booking.confirmed || booking.canceled) return false
        if (customerId.isBlank() || consent.customerId != customerId) return false
        if (nowMillis <= 0L || appointmentAtMillis <= nowMillis) return false
        if (type != NotificationPreferences.ReminderType.HOURS_24 &&
            type != NotificationPreferences.ReminderType.HOURS_2) return false
        if (!booking.emailConsent || !booking.businessEmailEnabled || booking.email.isNullOrBlank()) return false
        val window = if (type == NotificationPreferences.ReminderType.HOURS_24) 86400000L else 7200000L
        return appointmentAtMillis - nowMillis <= window &&
            NotificationPreferences.eligibleForPreview(settings, consent, type)
    }
}

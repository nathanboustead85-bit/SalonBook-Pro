package com.salonbook.pro

/** Offline planning only. Both snapshots must originate from a trusted caller.
 * Revalidate against authoritative data before any future delivery.
 */
internal object SecureReminderPlan {
    data class Snapshot(val booking: NotificationSafetyPolicy.BookingSnapshot, val customerId: String, val appointmentAtMillis: Long)
    fun windows(candidate: Snapshot?, current: Snapshot?, authenticatedBusinessId: String?, requestedBusinessId: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, nowMillis: Long): List<AutomaticReminderPlan.Window> {
        if (current == null || candidate != current || consent == null) return emptyList()
        val owner = authenticatedBusinessId ?: return emptyList()
        val booking = current.booking
        if (!NotificationPrivacyPolicy.authorized(booking, owner, requestedBusinessId)) return emptyList()
        if (!booking.confirmed || booking.canceled || !booking.emailConsent || !booking.businessEmailEnabled || booking.email.isNullOrBlank()) return emptyList()
        if (current.customerId.isBlank() || consent.customerId != current.customerId || !NotificationPreferences.hasRecordedConsent(consent)) return emptyList()
        if ((consent.consentRecordedAtMillis ?: Long.MAX_VALUE) > nowMillis) return emptyList()
        return AutomaticReminderPlan.windows(current.appointmentAtMillis, nowMillis, settings).filter {
            NotificationPreferences.eligibleForPreview(settings, consent, it.type)
        }
    }
}

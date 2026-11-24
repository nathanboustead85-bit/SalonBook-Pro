package com.salonbook.pro

/**
 * Phase 62.2 — offline-only preferences and explicit consent model.
 * Defaults are opt-out. These settings are not yet wired to a backend or delivery service.
 */
internal object NotificationPreferences {
    data class BusinessSettings(
        val emailConfirmationsEnabled: Boolean = false,
        val emailRemindersEnabled: Boolean = false,
        val reminder24HoursEnabled: Boolean = false,
        val reminder2HoursEnabled: Boolean = false,
        val manualWhatsAppRemindersEnabled: Boolean = false
    )

    data class CustomerConsent(
        val customerId: String,
        val emailNotificationsAllowed: Boolean = false,
        val whatsappContactAllowed: Boolean = false,
        val consentRecordedAtMillis: Long? = null
    )

    enum class ReminderType { CONFIRMATION, HOURS_24, HOURS_2, MANUAL_WHATSAPP }

    fun eligibleForPreview(
        settings: BusinessSettings,
        consent: CustomerConsent?,
        type: ReminderType
    ): Boolean {
        if (consent == null || consent.customerId.isBlank()) return false
        return when (type) {
            ReminderType.CONFIRMATION ->
                settings.emailConfirmationsEnabled && consent.emailNotificationsAllowed
            ReminderType.HOURS_24 ->
                settings.emailRemindersEnabled && settings.reminder24HoursEnabled &&
                    consent.emailNotificationsAllowed
            ReminderType.HOURS_2 ->
                settings.emailRemindersEnabled && settings.reminder2HoursEnabled &&
                    consent.emailNotificationsAllowed
            ReminderType.MANUAL_WHATSAPP ->
                settings.manualWhatsAppRemindersEnabled && consent.whatsappContactAllowed
        }
    }

    /** Consent must never be inferred from an existing phone/email or an empty timestamp. */
    fun hasRecordedConsent(consent: CustomerConsent?): Boolean =
        consent != null && consent.customerId.isNotBlank() &&
            consent.consentRecordedAtMillis != null && consent.consentRecordedAtMillis > 0L
}

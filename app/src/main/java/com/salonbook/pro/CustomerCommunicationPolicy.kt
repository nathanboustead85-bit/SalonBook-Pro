package com.salonbook.pro

/** Offline eligibility only. Contact and consent must be retrieved authoritatively before delivery. */
internal object CustomerCommunicationPolicy {
    data class Contact(val customerId: String, val email: String?, val phone: String?)
    fun eligible(canceled: SecureReminderPlan.Snapshot?, owner: String?, requested: String?,
                 contact: Contact?, consent: NotificationPreferences.CustomerConsent?, now: Long): Set<AppointmentCancellationPreview.Channel> {
        if (canceled == null || !NotificationPrivacyPolicy.authorized(canceled.booking,owner,requested) ||
            !canceled.booking.canceled || now <= 0 || contact == null || consent == null ||
            canceled.customerId.isBlank() || contact.customerId != canceled.customerId ||
            consent.customerId != canceled.customerId || !NotificationPreferences.hasRecordedConsent(consent) ||
            (consent.consentRecordedAtMillis ?: Long.MAX_VALUE) > now) return emptySet()
        val channels = mutableSetOf<AppointmentCancellationPreview.Channel>()
        val email = contact.email
        if (consent.emailNotificationsAllowed && canceled.booking.emailConsent &&
            email != null && email == canceled.booking.email && email.length <= 254 &&
            Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+").matches(email)) channels.add(AppointmentCancellationPreview.Channel.EMAIL)
        if (consent.whatsappContactAllowed && contact.phone?.let { Regex("\\+[1-9][0-9]{7,14}").matches(it) } == true)
            channels.add(AppointmentCancellationPreview.Channel.WHATSAPP)
        return channels.toSet()
    }
}

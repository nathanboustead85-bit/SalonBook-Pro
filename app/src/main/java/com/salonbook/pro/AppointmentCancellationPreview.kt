package com.salonbook.pro

import java.security.MessageDigest

/** Pure offline transition; caller must atomically persist booking and outbox in future backend. */
internal object AppointmentCancellationPreview {
    enum class Channel { EMAIL, WHATSAPP }
    data class Appointment(val snapshot: SecureReminderPlan.Snapshot, val staffId: String, val endMillis: Long)
    data class Intent(val key: String, val channel: Channel)
    data class Plan(val canceled: Appointment, val notifications: List<Intent>)
    private fun key(parts: List<String>) = MessageDigest.getInstance("SHA-256")
        .digest(parts.joinToString("") { "${it.length}:$it" }.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it.toInt() and 255) }

    fun cancel(candidate: Appointment?, current: Appointment?, owner: String?, requested: String?,
               consent: NotificationPreferences.CustomerConsent?, phone: String?, now: Long): Plan? {
        if (current == null || candidate != current || now <= 0) return null
        val s = current.snapshot
        val b = s.booking
        if (!NotificationPrivacyPolicy.authorized(b,owner,requested) || b.canceled || b.revision == Long.MAX_VALUE) return null
        val canceled = current.copy(snapshot=s.copy(booking=b.copy(canceled=true,revision=b.revision+1)))
        val intents = mutableListOf<Intent>()
        fun add(channel: Channel) {
            intents.add(Intent(key(listOf(b.businessId,b.bookingId,(b.revision+1).toString(),"canceled",channel.name)),channel))
        }
        // Missing contact or consent never prevents cancellation.
        if (consent != null && consent.customerId == s.customerId &&
            NotificationPreferences.hasRecordedConsent(consent) &&
            (consent.consentRecordedAtMillis ?: Long.MAX_VALUE) <= now) {
            if (consent.emailNotificationsAllowed && b.emailConsent && !b.email.isNullOrBlank()) add(Channel.EMAIL)
            if (consent.whatsappContactAllowed && !phone.isNullOrBlank()) add(Channel.WHATSAPP)
        }
        return Plan(canceled,intents.toList())
    }

    fun canDeleteRecord(current: Appointment?, owner: String?, requested: String?, explicitlyConfirmed: Boolean, notificationHistoryRetained: Boolean): Boolean =
        explicitlyConfirmed && notificationHistoryRetained && current?.snapshot?.booking?.canceled == true &&
            NotificationPrivacyPolicy.authorized(current.snapshot.booking,owner,requested)

    /** Other overlapping appointments continue to block the slot. */
    fun slotAvailable(appointments: List<Appointment>, owner: String, staffId: String, start: Long, end: Long): Boolean {
        if (owner.isBlank() || staffId.isBlank() || start <= 0 || end <= start) return false
        return appointments.none {
            it.snapshot.booking.businessId == owner && it.staffId == staffId &&
                !it.snapshot.booking.canceled &&
                (it.endMillis <= it.snapshot.appointmentAtMillis ||
                    (it.snapshot.appointmentAtMillis < end && it.endMillis > start))
        }
    }
}

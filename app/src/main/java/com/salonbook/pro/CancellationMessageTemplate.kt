package com.salonbook.pro

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Offline plain-text preview only. Business name, slug and timezone require trusted owner mapping. */
internal object CancellationMessageTemplate {
    data class Business(val ownerId: String, val name: String, val slug: String, val zone: String)
    data class Message(val subject: String?, val body: String)
    fun render(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?,
               business: Business, contact: CustomerCommunicationPolicy.Contact?,
               consent: NotificationPreferences.CustomerConsent?, channel: AppointmentCancellationPreview.Channel,
               now: Long): Message? {
        if (snapshot == null || business.ownerId != owner || snapshot.appointmentAtMillis <= 0 ||
            channel !in CustomerCommunicationPolicy.eligible(snapshot,owner,requested,contact,consent,now)) return null
        val name = business.name.trim()
        if (name.isEmpty() || name.length > 100 || name.any { Character.isISOControl(it) || Character.getType(it) == Character.FORMAT.toInt() } ||
            name.any { it in "<>&*_`~" }) return null
        if (!Regex("[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?").matches(business.slug)) return null
        val date = try {
            DateTimeFormatter.ofPattern("EEEE d MMMM uuuu 'at' HH:mm z",Locale.UK)
                .withZone(ZoneId.of(business.zone)).format(Instant.ofEpochMilli(snapshot.appointmentAtMillis))
        } catch (e: Exception) { return null }
        val link = "https://boustio.co.uk/book/"+business.slug
        val body = "Hello,\n\nYour appointment with $name on $date has been cancelled. We're sorry for any inconvenience.\n\nTo book another appointment, please visit:\n$link\n\nThank you,\n$name"
        return Message(if (channel == AppointmentCancellationPreview.Channel.EMAIL) "Appointment cancellation - $name" else null,body)
    }
}

package com.salonbook.pro

/** Offline state transition policy. Actor identity and current state require authoritative backend verification. */
internal object CommunicationPreferencesPreview {
    data class Choice(val allowed: Boolean = false, val changedAt: Long = 0)
    data class State(val businessId: String, val customerId: String, val revision: Long = 0,
                     val email: Choice = Choice(), val whatsapp: Choice = Choice())
    data class Controls(val email: Boolean = false, val whatsapp: Boolean = false)
    fun change(candidate: State, current: State, actorCustomer: String?, businessId: String?,
               channel: AppointmentCancellationPreview.Channel, allowed: Boolean, now: Long): State? {
        if (candidate != current || current.businessId.isBlank() || current.customerId.isBlank() ||
            actorCustomer != current.customerId || businessId != current.businessId ||
            current.revision < 0 || current.revision == Long.MAX_VALUE ||
            now <= maxOf(current.email.changedAt,current.whatsapp.changedAt,0L)) return null
        val choice = Choice(allowed,now)
        return when(channel) {
            AppointmentCancellationPreview.Channel.EMAIL -> current.copy(revision=current.revision+1,email=choice)
            AppointmentCancellationPreview.Channel.WHATSAPP -> current.copy(revision=current.revision+1,whatsapp=choice)
        }
    }
    fun eligible(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?,
                 contact: CustomerCommunicationPolicy.Contact?, candidate: State?, current: State?,
                 controls: Controls, now: Long): Set<AppointmentCancellationPreview.Channel> {
        if (snapshot == null || current == null || candidate != current ||
            current.businessId != snapshot.booking.businessId || current.customerId != snapshot.customerId ||
            current.revision <= 0 || now <= 0) return emptySet()
        val result = mutableSetOf<AppointmentCancellationPreview.Channel>()
        for (channel in AppointmentCancellationPreview.Channel.values()) {
            val email = channel == AppointmentCancellationPreview.Channel.EMAIL
            val choice = if (email) current.email else current.whatsapp
            if (!choice.allowed || choice.changedAt <= 0 || choice.changedAt > now ||
                !(if (email) controls.email else controls.whatsapp)) continue
            val consent = NotificationPreferences.CustomerConsent(current.customerId,email,!email,choice.changedAt)
            if (channel in CustomerCommunicationPolicy.eligible(snapshot,owner,requested,contact,consent,now)) result.add(channel)
        }
        return result.toSet()
    }
}

package com.salonbook.pro
import java.io.File

/** Offline coordinator. Caller must commit cancellation before invoking communication; no live delivery. */
internal class CancellationIntegrationPreview(private val directory: File) {
    data class Outcome(val recovery: CommunicationRecoveryPreview.Status, val trackingSaved: Boolean)
    fun cancel(candidate: AppointmentCancellationPreview.Appointment?, current: AppointmentCancellationPreview.Appointment?,
               owner: String?, requested: String?, now: Long): AppointmentCancellationPreview.Appointment? =
        AppointmentCancellationPreview.cancel(candidate,current,owner,requested,null,null,now)?.canceled

    fun communicate(committed: AppointmentCancellationPreview.Appointment, owner: String?, requested: String?,
                    business: CancellationMessageTemplate.Business, contact: CustomerCommunicationPolicy.Contact?,
                    preferences: CommunicationPreferencesPreview.State?, current: CommunicationPreferencesPreview.State?,
                    now: Long, simulate: (AppointmentCancellationPreview.Channel,CancellationMessageTemplate.Message) -> CommunicationRecoveryPreview.Response):
                    Map<AppointmentCancellationPreview.Channel,Outcome> = synchronized(lock) {
        val snapshot = committed.snapshot
        if (!snapshot.booking.canceled || !NotificationPrivacyPolicy.authorized(snapshot.booking,owner,requested)) return@synchronized emptyMap()
        ReminderSchedulePreview(directory).reconcile(snapshot,snapshot,owner,requested,null,NotificationPreferences.BusinessSettings(),now)
        val controls = BusinessCommunicationControlsPreview(directory).effective(owner,requested)
        val eligible = CommunicationPreferencesPreview.eligible(snapshot,owner,requested,contact,preferences,current,controls,now)
        val results = mutableMapOf<AppointmentCancellationPreview.Channel,Outcome>()
        val tracking = DeliveryStatusPreview(directory)
        val history = CommunicationHistoryPreview(directory)
        for (channel in eligible) {
            val state = current ?: continue
            val email = channel == AppointmentCancellationPreview.Channel.EMAIL
            val choice = if (email) state.email else state.whatsapp
            val consent = NotificationPreferences.CustomerConsent(state.customerId,email,!email,choice.changedAt)
            val message = CancellationMessageTemplate.render(snapshot,owner,requested,business,contact,consent,channel,now) ?: continue
            val previous = tracking.lookup(snapshot,owner,requested,channel)
            if (previous != null && previous.status != DeliveryStatusPreview.Status.PENDING) continue
            if (previous == null && tracking.update(snapshot,owner,requested,channel,now,DeliveryStatusPreview.Status.PENDING) != DeliveryStatusPreview.Result.UPDATED) continue
            val recovery = CommunicationRecoveryPreview(directory).attempt(snapshot,owner,requested,contact,preferences,current,controls,channel,now) { simulate(channel,message) }
            val status = when(recovery) {
                CommunicationRecoveryPreview.Status.PROCESSED -> DeliveryStatusPreview.Status.ACCEPTED
                CommunicationRecoveryPreview.Status.EXHAUSTED, CommunicationRecoveryPreview.Status.REJECTED -> DeliveryStatusPreview.Status.FAILED
                CommunicationRecoveryPreview.Status.UNKNOWN -> DeliveryStatusPreview.Status.UNKNOWN
                else -> null
            }
            var saved = true
            if (status != null) {
                val time = maxOf(now,(previous?.timestamp ?: now)+1)
                val h = when(status) {
                    DeliveryStatusPreview.Status.ACCEPTED -> CommunicationHistoryPreview.Status.ACCEPTED
                    DeliveryStatusPreview.Status.FAILED -> CommunicationHistoryPreview.Status.REJECTED
                    else -> CommunicationHistoryPreview.Status.UNKNOWN
                }
                val hr = history.record(snapshot,owner,requested,channel,time,h)
                val tr = tracking.update(snapshot,owner,requested,channel,time,status)
                saved = hr in setOf(CommunicationHistoryPreview.Result.RECORDED,CommunicationHistoryPreview.Result.DUPLICATE) &&
                    tr in setOf(DeliveryStatusPreview.Result.UPDATED,DeliveryStatusPreview.Result.DUPLICATE)
            }
            results[channel] = Outcome(recovery,saved)
        }
        results.toMap()
    }
    companion object { private val lock = Any() }
}

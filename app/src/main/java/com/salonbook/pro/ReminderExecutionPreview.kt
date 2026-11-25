package com.salonbook.pro

import java.io.File

/** Offline claim only. Caller must supply authoritative fresh snapshots in future backend integration. */
internal class ReminderExecutionPreview(private val directory: File) {
    companion object { const val MAX_LATENESS = 300000L }
    private fun eligible(event: ReminderSchedulePreview.Event, candidate: SecureReminderPlan.Snapshot?, current: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, now: Long): Boolean {
        if (current == null || candidate != current || owner == null || now <= 0 || !directory.isDirectory) return false
        if (!NotificationPrivacyPolicy.authorized(current.booking,owner,requested)) return false
        val due = event.window.dueAtMillis
        if (due <= 0 || now < due || now - due > MAX_LATENESS || now >= current.appointmentAtMillis) return false
        when (event.window.type) {
            NotificationPreferences.ReminderType.HOURS_24 -> Unit
            NotificationPreferences.ReminderType.HOURS_2 -> Unit
            else -> return false
        }
        if (consent == null || (consent.consentRecordedAtMillis ?: Long.MAX_VALUE) > now) return false
        // Reconstruct the exact planned event at its due time, not at the later claim time.
        val expected = ReminderSchedulePreview().reconcile(candidate,current,owner,requested,consent,settings,due)
        if (event !in expected) return false
        return true
    }
    fun claim(event: ReminderSchedulePreview.Event, candidate: SecureReminderPlan.Snapshot?, current: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, now: Long): Boolean {
        return claimResult(event,candidate,current,owner,requested,consent,settings,now) == PersistentReminderPreviewLedger.Result.CLAIMED
    }
    fun claimResult(event: ReminderSchedulePreview.Event, candidate: SecureReminderPlan.Snapshot?, current: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, now: Long): PersistentReminderPreviewLedger.Result {
        if (!eligible(event,candidate,current,owner,requested,consent,settings,now) || current == null || owner == null) return PersistentReminderPreviewLedger.Result.REJECTED
        val kind = if (event.window.type == NotificationPreferences.ReminderType.HOURS_24) "reminder-24h" else "reminder-2h"
        return PersistentReminderPreviewLedger(directory).claimResult(current.booking,current.booking,owner,kind,true)
    }
}

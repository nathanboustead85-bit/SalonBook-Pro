package com.salonbook.pro

import java.io.File

/** Offline claim only. Caller must supply authoritative fresh snapshots in future backend integration. */
internal class ReminderExecutionPreview(private val directory: File) {
    companion object { const val MAX_LATENESS = 300000L }
    fun claim(event: ReminderSchedulePreview.Event, candidate: SecureReminderPlan.Snapshot?, current: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, now: Long): Boolean {
        if (current == null || candidate != current || owner == null || now <= 0 || !directory.isDirectory) return false
        if (!NotificationPrivacyPolicy.authorized(current.booking,owner,requested)) return false
        val due = event.window.dueAtMillis
        if (due <= 0 || now < due || now - due > MAX_LATENESS || now >= current.appointmentAtMillis) return false
        val kind = when (event.window.type) {
            NotificationPreferences.ReminderType.HOURS_24 -> "reminder-24h"
            NotificationPreferences.ReminderType.HOURS_2 -> "reminder-2h"
            else -> return false
        }
        if (consent == null || (consent.consentRecordedAtMillis ?: Long.MAX_VALUE) > now) return false
        // Reconstruct the exact planned event at its due time, not at the later claim time.
        val expected = ReminderSchedulePreview().reconcile(candidate,current,owner,requested,consent,settings,due)
        if (event !in expected) return false
        return PersistentReminderPreviewLedger(directory).claim(current.booking,current.booking,owner,kind,true)
    }
}

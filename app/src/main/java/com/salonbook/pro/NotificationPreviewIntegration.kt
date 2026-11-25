package com.salonbook.pro

import java.io.File

/** Offline only. Caller supplies current snapshots; no delivery or scheduling. */
internal class NotificationPreviewIntegration(directory: File, private val health: NotificationHealthMonitor = NotificationHealthMonitor(directory)) {
    private val ledger = PersistentReminderPreviewLedger(directory)
    fun healthState() = health.snapshot()
    @Synchronized fun preview(
        candidate: NotificationSafetyPolicy.BookingSnapshot?,
        current: NotificationSafetyPolicy.BookingSnapshot?,
        authenticatedBusinessId: String?,
        requestedBusinessId: String?,
        customerId: String,
        consent: NotificationPreferences.CustomerConsent?,
        settings: NotificationPreferences.BusinessSettings,
        type: NotificationPreferences.ReminderType,
        appointmentAtMillis: Long,
        nowMillis: Long
    ): String {
        val rejected = NotificationPrivacyPolicy.diagnostic(NotificationPrivacyPolicy.Outcome.INVALID_REQUEST)
        if (!NotificationPrivacyPolicy.authorized(current, authenticatedBusinessId, requestedBusinessId)) return rejected
        val owner = authenticatedBusinessId ?: return rejected
        if (candidate != current || consent == null ||
            (consent.consentRecordedAtMillis ?: Long.MAX_VALUE) > nowMillis) return rejected
        if (!ReminderPreviewPolicy.eligible(current, owner, customerId, consent, settings, type, appointmentAtMillis, nowMillis)) return rejected
        val event = when (type) {
            NotificationPreferences.ReminderType.HOURS_24 -> "reminder-24h"
            NotificationPreferences.ReminderType.HOURS_2 -> "reminder-2h"
            else -> return rejected
        }
        // Duplicate and storage failures intentionally share a generic rejection.
        val result = ledger.claimResult(candidate, current, owner, event, true)
        health.record(result)
        if (result != PersistentReminderPreviewLedger.Result.CLAIMED) return rejected
        return NotificationPrivacyPolicy.diagnostic(NotificationPrivacyPolicy.Outcome.PREVIEW_ALLOWED)
    }
}

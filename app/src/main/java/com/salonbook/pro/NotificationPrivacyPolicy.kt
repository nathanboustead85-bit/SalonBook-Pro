package com.salonbook.pro

/** Offline diagnostic boundary: no customer identifiers or exception messages in output. */
internal object NotificationPrivacyPolicy {
    enum class Outcome { PREVIEW_ALLOWED, INVALID_REQUEST, STORAGE_UNAVAILABLE }
    fun diagnostic(outcome: Outcome): String = when (outcome) {
        Outcome.PREVIEW_ALLOWED -> "notification_preview_allowed"
        Outcome.INVALID_REQUEST -> "notification_preview_rejected"
        Outcome.STORAGE_UNAVAILABLE -> "notification_preview_storage_unavailable"
    }
    fun authorized(snapshot: NotificationSafetyPolicy.BookingSnapshot?, authenticatedBusinessId: String?, requestedBusinessId: String?): Boolean {
        if (snapshot == null || authenticatedBusinessId.isNullOrBlank() || requestedBusinessId.isNullOrBlank()) return false
        return authenticatedBusinessId == requestedBusinessId &&
            snapshot.businessId == authenticatedBusinessId &&
            snapshot.bookingId.isNotBlank() && snapshot.revision > 0L
    }
}

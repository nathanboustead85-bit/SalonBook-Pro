package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class NotificationPrivacyPolicyTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner-a", "private-booking", 1L, true, false, "private@example.invalid", true, true)
    @Test fun ownerIsolation() {
        assertTrue(NotificationPrivacyPolicy.authorized(booking, "owner-a", "owner-a"))
        assertFalse(NotificationPrivacyPolicy.authorized(booking, "owner-b", "owner-a"))
        assertFalse(NotificationPrivacyPolicy.authorized(booking, "owner-a", "owner-b"))
        assertFalse(NotificationPrivacyPolicy.authorized(booking, "owner-b", "owner-b"))
    }
    @Test fun invalidRequests() {
        assertFalse(NotificationPrivacyPolicy.authorized(null, "owner-a", "owner-a"))
        assertFalse(NotificationPrivacyPolicy.authorized(booking, null, "owner-a"))
        assertFalse(NotificationPrivacyPolicy.authorized(booking, "", ""))
        assertFalse(NotificationPrivacyPolicy.authorized(booking.copy(revision = 0L), "owner-a", "owner-a"))
    }
    @Test fun diagnosticsAreFixedAndNonIdentifying() {
        val codes = NotificationPrivacyPolicy.Outcome.values().map { NotificationPrivacyPolicy.diagnostic(it) }
        assertEquals(3, codes.distinct().size)
        assertTrue(codes.all { it.matches(Regex("notification_preview_[a-z_]+")) })
        assertFalse(codes.any { it.contains("private") || it.contains("owner-a") })
    }
    @Test fun liveDeliveryDisabled() {
        assertFalse(NotificationSafetyPolicy.mayQueueEmail(booking, "owner-a"))
        assertFalse(NotificationSafetyPolicy.LIVE_WHATSAPP_ENABLED)
    }
}

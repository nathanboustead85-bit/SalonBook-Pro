package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class ReminderPreviewPolicyTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("business", "booking", 1L, true, false, "test@example.invalid", true, true)
    private val consent = NotificationPreferences.CustomerConsent("client", true, false, 1L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true, reminder2HoursEnabled = true)
    private val now = 100000L
    private fun eligible(b: NotificationSafetyPolicy.BookingSnapshot? = booking, c: NotificationPreferences.CustomerConsent? = consent, owner: String = "business", customer: String = "client", delta: Long = 7200000L, s: NotificationPreferences.BusinessSettings = settings, type: NotificationPreferences.ReminderType = NotificationPreferences.ReminderType.HOURS_2) =
        ReminderPreviewPolicy.eligible(b, owner, customer, c, s, type, now + delta, now)

    @Test fun validPreview() { assertTrue(eligible()); assertTrue(eligible(delta = 86400000L, type = NotificationPreferences.ReminderType.HOURS_24)) }
    @Test fun invalidTime() { assertFalse(eligible(delta = 0L)); assertFalse(eligible(delta = -1L)); assertFalse(eligible(delta = 7200001L)) }
    @Test fun consentAndIdentity() { assertFalse(eligible(c = null)); assertFalse(eligible(c = consent.copy(consentWithdrawnAtMillis = 2L))); assertFalse(eligible(customer = "other")); assertFalse(eligible(owner = "other")) }
    @Test fun bookingAndSettings() { assertFalse(eligible(b = null)); assertFalse(eligible(b = booking.copy(canceled = true))); assertFalse(eligible(b = booking.copy(revision = 0L))); assertFalse(eligible(s = settings.copy(emailRemindersEnabled = false))); assertFalse(eligible(type = NotificationPreferences.ReminderType.MANUAL_WHATSAPP)) }
    @Test fun liveDeliveryDisabled() { assertFalse(NotificationSafetyPolicy.mayQueueEmail(booking, "business")); assertFalse(NotificationSafetyPolicy.LIVE_WHATSAPP_ENABLED); assertFalse(NotificationSafetyPolicy.LIVE_BOOKING_ENABLED) }
}

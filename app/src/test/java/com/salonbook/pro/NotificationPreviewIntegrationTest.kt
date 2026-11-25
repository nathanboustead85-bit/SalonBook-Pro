package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationPreviewIntegrationTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "private@example.invalid", true, true)
    private val consent = NotificationPreferences.CustomerConsent("customer", true, false, 100L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true)
    private val allowed = "notification_preview_allowed"
    private val rejected = "notification_preview_rejected"
    private fun preview(owner: String? = "owner", requested: String? = "owner", current: NotificationSafetyPolicy.BookingSnapshot = booking, permission: NotificationPreferences.CustomerConsent = consent, config: NotificationPreferences.BusinessSettings = settings, customer: String = "customer", appointment: Long = 2000L) =
        NotificationPreviewIntegration(folder.root).preview(booking, current, owner, requested, customer, permission, config, NotificationPreferences.ReminderType.HOURS_24, appointment, 1000L)
    @Test fun durableDuplicateProtection() { assertEquals(allowed, preview()); assertEquals(rejected, preview()) }
    @Test fun rejectsWrongOwnerAndStaleSnapshot() {
        assertEquals(rejected, preview(owner = "other"))
        assertEquals(rejected, preview(requested = "other"))
        assertEquals(rejected, preview(owner = null))
        assertEquals(rejected, preview(current = booking.copy(revision = 2L)))
        assertEquals(allowed, preview())
    }
    @Test fun rejectsWithdrawnFutureAndMismatchedConsent() {
        assertEquals(rejected, preview(permission = NotificationPreferences.withdrawConsent(consent, 500L)))
        assertEquals(rejected, preview(permission = consent.copy(consentRecordedAtMillis = 1001L)))
        assertEquals(rejected, preview(customer = "other"))
        assertEquals(rejected, preview(config = NotificationPreferences.BusinessSettings()))
        assertEquals(rejected, preview(appointment = 999L))
        assertFalse(File(folder.root, "reminder-preview-v1.history").exists())
        assertEquals(allowed, preview())
    }
    @Test fun corruptHistoryIsNotOverwritten() {
        val history = File(folder.root, "reminder-preview-v1.history")
        history.writeText("corrupt")
        assertEquals(rejected, preview())
        assertEquals("corrupt", history.readText())
    }
    @Test fun liveFlagsRemainDisabled() {
        assertFalse(NotificationSafetyPolicy.LIVE_EMAIL_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_WHATSAPP_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_BOOKING_ENABLED)
        assertFalse(NotificationSafetyPolicy.mayQueueEmail(booking, "owner"))
    }
}

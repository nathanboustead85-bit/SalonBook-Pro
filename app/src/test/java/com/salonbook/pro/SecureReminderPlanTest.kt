package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class SecureReminderPlanTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "private@example.invalid", true, true)
    private val snapshot = SecureReminderPlan.Snapshot(booking, "customer", 200000000L)
    private val consent = NotificationPreferences.CustomerConsent("customer", true, false, 100L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true, reminder2HoursEnabled = true)
    private fun plan(candidate: SecureReminderPlan.Snapshot? = snapshot, current: SecureReminderPlan.Snapshot? = snapshot, owner: String? = "owner", requested: String? = "owner", permission: NotificationPreferences.CustomerConsent? = consent, config: NotificationPreferences.BusinessSettings = settings) =
        SecureReminderPlan.windows(candidate, current, owner, requested, permission, config, 1000L)
    @Test fun validFutureWindows() { assertEquals(2, plan().size) }
    @Test fun ownershipAndMissingSnapshots() {
        assertTrue(plan(owner = "other").isEmpty())
        assertTrue(plan(requested = "other").isEmpty())
        assertTrue(plan(owner = null).isEmpty())
        assertTrue(plan(current = null).isEmpty())
        assertTrue(plan(candidate = null).isEmpty())
    }
    @Test fun staleRevisionTimeAndCustomerRejected() {
        assertTrue(plan(current = snapshot.copy(booking = booking.copy(revision = 2L))).isEmpty())
        assertTrue(plan(current = snapshot.copy(appointmentAtMillis = 200000001L)).isEmpty())
        assertTrue(plan(current = snapshot.copy(customerId = "other")).isEmpty())
    }
    @Test fun cancelledUnconfirmedAndMissingEmailRejected() {
        for (invalid in listOf(booking.copy(canceled = true), booking.copy(confirmed = false), booking.copy(email = null), booking.copy(emailConsent = false), booking.copy(businessEmailEnabled = false))) {
            val s = snapshot.copy(booking = invalid)
            assertTrue(plan(candidate = s, current = s).isEmpty())
        }
    }
    @Test fun consentAndPreferencesFailClosed() {
        assertTrue(plan(permission = null).isEmpty())
        assertTrue(plan(permission = consent.copy(customerId = "other")).isEmpty())
        assertTrue(plan(permission = consent.copy(consentRecordedAtMillis = 1001L)).isEmpty())
        assertTrue(plan(permission = NotificationPreferences.withdrawConsent(consent, 500L)).isEmpty())
        assertTrue(plan(config = NotificationPreferences.BusinessSettings()).isEmpty())
        assertEquals(1, plan(config = settings.copy(reminder2HoursEnabled = false)).size)
    }
}

package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ReminderSchedulePreviewTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "private@example.invalid", true, true)
    private val snapshot = SecureReminderPlan.Snapshot(booking, "customer", 200000000L)
    private val consent = NotificationPreferences.CustomerConsent("customer", true, false, 100L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true, reminder2HoursEnabled = true)
    private fun apply(schedule: ReminderSchedulePreview, s: SecureReminderPlan.Snapshot = snapshot, owner: String = "owner") = schedule.reconcile(s,s,owner,owner,consent,settings,1000L)
    @Test fun concurrentReconciliationDoesNotDuplicate() {
        val schedule = ReminderSchedulePreview()
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = (1..64).map { pool.submit<List<ReminderSchedulePreview.Event>> { apply(schedule) } }.map { it.get(20, TimeUnit.SECONDS) }
            assertEquals(1, results.distinct().size)
            assertEquals(2, schedule.count())
            assertEquals(results.first(), apply(ReminderSchedulePreview()))
        } finally { pool.shutdownNow() }
    }
    @Test fun rescheduleReplacesAndCancellationClears() {
        val schedule = ReminderSchedulePreview()
        val first = apply(schedule)
        val moved = snapshot.copy(booking = booking.copy(revision = 2L), appointmentAtMillis = 210000000L)
        val next = apply(schedule,moved)
        assertEquals(2, next.size)
        assertTrue(first.map { it.id }.intersect(next.map { it.id }.toSet()).isEmpty())
        assertTrue(apply(schedule).isEmpty())
        assertEquals(2, schedule.count())
        assertTrue(apply(schedule,moved.copy(booking = moved.booking.copy(revision = 3L,canceled = true))).isEmpty())
        assertTrue(apply(schedule,moved).isEmpty())
        assertEquals(0, schedule.count())
    }
    @Test fun unauthorizedAndConflictingRevisionCannotReplace() {
        val schedule = ReminderSchedulePreview()
        apply(schedule)
        assertTrue(apply(schedule,owner = "other").isEmpty())
        assertTrue(apply(schedule,snapshot.copy(appointmentAtMillis = 210000000L)).isEmpty())
        assertEquals(2,schedule.count())
    }
}

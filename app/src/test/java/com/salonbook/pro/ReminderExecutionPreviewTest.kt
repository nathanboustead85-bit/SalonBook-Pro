package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ReminderExecutionPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",1L,true,false,"private@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",200000000L)
    private val consent = NotificationPreferences.CustomerConsent("customer",true,false,100L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true,reminder24HoursEnabled = true,reminder2HoursEnabled = true)
    private val event = ReminderSchedulePreview().reconcile(snapshot,snapshot,"owner","owner",consent,settings,1000L).first()
    private val due = event.window.dueAtMillis
    private fun claim(now: Long = due, current: SecureReminderPlan.Snapshot = snapshot, c: NotificationPreferences.CustomerConsent = consent, e: ReminderSchedulePreview.Event = event, owner: String = "owner", s: NotificationPreferences.BusinessSettings = settings) =
        ReminderExecutionPreview(folder.root).claim(e,snapshot,current,owner,owner,c,s,now)
    @Test fun timingAndRestartDeduplication() {
        assertFalse(claim(due-1))
        assertFalse(claim(due+300001))
        assertTrue(claim(due+300000))
        assertFalse(claim(due+300000))
    }
    @Test fun staleConsentAndForgedEventsRejected() {
        assertFalse(claim(current = snapshot.copy(booking = booking.copy(revision = 2L,canceled = true))))
        assertFalse(claim(current = snapshot.copy(appointmentAtMillis = 210000000L)))
        assertFalse(claim(c = consent.copy(consentWithdrawnAtMillis = due)))
        assertFalse(claim(c = consent.copy(consentRecordedAtMillis = due+1)))
        assertFalse(claim(c = consent.copy(customerId = "other")))
        assertFalse(claim(e = event.copy(id = "forged")))
        assertFalse(claim(owner = "other"))
        assertFalse(claim(s = settings.copy(emailRemindersEnabled = false)))
        assertTrue(claim())
    }
    @Test fun concurrentClaimsOnlyOneSucceeds() {
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = (1..64).map { pool.submit<Boolean> { claim() } }.map { it.get(20,TimeUnit.SECONDS) }
            assertEquals(1,results.count { it })
        } finally { pool.shutdownNow() }
    }
}

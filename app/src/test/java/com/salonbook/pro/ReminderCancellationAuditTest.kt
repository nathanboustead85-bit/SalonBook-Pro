package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ReminderCancellationAuditTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",1,true,false,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",100000000L)
    private val consent = NotificationPreferences.CustomerConsent("customer",true,true,1L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled=true,reminder2HoursEnabled=true)
    private val success = PersistentReminderPreviewLedger.Result.CLAIMED
    private val rejected = PersistentReminderPreviewLedger.Result.REJECTED
    private fun schedule() = ReminderSchedulePreview(folder.root)
    private fun claim(event: ReminderSchedulePreview.Event) = schedule().claimScheduled(event,snapshot,snapshot,"owner","owner",consent,settings,event.window.dueAtMillis)
    @Test fun missingScheduleAndCancellationTombstoneRejectStaleClaims() {
        val event = ReminderSchedulePreview().reconcile(snapshot,snapshot,"owner","owner",consent,settings,100).single()
        assertEquals(rejected,claim(event))
        assertEquals(listOf(event),schedule().reconcile(snapshot,snapshot,"owner","owner",consent,settings,100))
        val canceled = AppointmentCancellationPreview.cancel(
            AppointmentCancellationPreview.Appointment(snapshot,"staff",101000000L),
            AppointmentCancellationPreview.Appointment(snapshot,"staff",101000000L),
            "owner","owner",consent,"+447000000000",200)!!
        val current = canceled.canceled.snapshot
        assertTrue(schedule().reconcile(current,current,"owner","owner",consent,settings,200).isEmpty())
        assertEquals(rejected,claim(event))
        assertTrue(schedule().reconcile(snapshot,snapshot,"owner","owner",consent,settings,300).isEmpty())
        assertTrue(CancellationOutboxPreview(folder.root).enqueue(canceled.notifications))
        assertEquals(2,canceled.notifications.size)
    }
    @Test fun persistedMembershipAndDuplicateClaim() {
        val event = schedule().reconcile(snapshot,snapshot,"owner","owner",consent,settings,100).single()
        assertEquals(success,claim(event))
        assertEquals(rejected,claim(event))
        File(folder.root,"reminder-schedule-v1.state").writeText("corrupt")
        assertEquals(PersistentReminderPreviewLedger.Result.STORAGE_FAILURE,claim(event))
    }
    @Test fun concurrentCancellationChannelsProcessOnceEach() {
        val appointment = AppointmentCancellationPreview.Appointment(snapshot,"staff",101000000L)
        val plan = AppointmentCancellationPreview.cancel(appointment,appointment,"owner","owner",consent,"+447000000000",200)!!
        assertTrue(CancellationOutboxPreview(folder.root).enqueue(plan.notifications))
        val counts = plan.notifications.associate { it.key to java.util.concurrent.atomic.AtomicInteger() }
        val pool = Executors.newFixedThreadPool(8)
        try {
            (0 until 64).map { i -> pool.submit<CancellationOutboxPreview.Status> {
                val intent = plan.notifications[i%2]
                CancellationOutboxPreview(folder.root).attempt(intent,300) { counts.getValue(intent.key).incrementAndGet(); success }
            } }.forEach { assertEquals(CancellationOutboxPreview.Status.PROCESSED,it.get(20,TimeUnit.SECONDS)) }
            assertTrue(counts.values.all { it.get()==1 })
            assertTrue(CancellationOutboxPreview(folder.root).enqueue(plan.notifications))
            plan.notifications.forEach { assertEquals(CancellationOutboxPreview.Status.PROCESSED,CancellationOutboxPreview(folder.root).status(it.key)) }
        } finally { pool.shutdownNow() }
    }
}

package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class CancellationIntegrationPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,false,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",1795622400000L)
    private val appointment = AppointmentCancellationPreview.Appointment(snapshot,"staff",1795626000000L)
    private val contact = CustomerCommunicationPolicy.Contact("customer","test@example.invalid","+447000000000")
    private val state = CommunicationPreferencesPreview.State("owner","customer",2,CommunicationPreferencesPreview.Choice(true,10),CommunicationPreferencesPreview.Choice(true,20))
    private val business = CancellationMessageTemplate.Business("owner","Test Salon","test-salon","Europe/London")
    private val email = AppointmentCancellationPreview.Channel.EMAIL
    private val whatsapp = AppointmentCancellationPreview.Channel.WHATSAPP
    @Test fun cancellationAndRecovery() {
        val dir = folder.root
        val coordinator = CancellationIntegrationPreview(dir)
        assertNull(coordinator.cancel(appointment,appointment,"other","other",100))
        val canceled = coordinator.cancel(appointment,appointment,"owner","owner",100)!!
        assertTrue(canceled.snapshot.booking.canceled)
        assertTrue(AppointmentCancellationPreview.slotAvailable(listOf(canceled),"owner","staff",snapshot.appointmentAtMillis,appointment.endMillis))
        assertTrue(AppointmentCancellationPreview.canDeleteRecord(canceled,"owner","owner",true,true))
        assertFalse(AppointmentCancellationPreview.canDeleteRecord(canceled,"owner","owner",true,false))
        val controls = BusinessCommunicationControlsPreview(dir)
        assertTrue(controls.change("owner","owner",controls.read("owner","owner")!!,true,true,false,false,50))
        val result = coordinator.communicate(canceled,"owner","owner",business,contact,state,state,100) { channel,message ->
            assertTrue(message.body.contains("cancelled"))
            if (channel == email) CommunicationRecoveryPreview.Response.DEFINITELY_NOT_SUBMITTED else CommunicationRecoveryPreview.Response.ACCEPTED
        }
        assertEquals(CommunicationRecoveryPreview.Status.PENDING,result[email]!!.recovery)
        assertEquals(CommunicationRecoveryPreview.Status.PROCESSED,result[whatsapp]!!.recovery)
        val resumed = CancellationIntegrationPreview(dir).communicate(canceled,"owner","owner",business,contact,state,state,30100) { channel,_ ->
            assertEquals(email,channel)
            CommunicationRecoveryPreview.Response.ACCEPTED
        }
        assertTrue(resumed[email]!!.trackingSaved)
        assertEquals(DeliveryStatusPreview.Status.ACCEPTED,DeliveryStatusPreview(dir).lookup(canceled.snapshot,"owner","owner",email)!!.status)
        assertEquals(CommunicationHistoryPreview.Status.ACCEPTED,CommunicationHistoryPreview(dir).lookup(canceled.snapshot,"owner","owner",whatsapp)!!.status)
        assertTrue(coordinator.communicate(canceled,"owner","owner",business,contact,state,state,40000){_,_->error("duplicate")}.isEmpty())
    }
    @Test fun disabledControlsNeverPreventCancellation() {
        val coordinator = CancellationIntegrationPreview(folder.root)
        val canceled = coordinator.cancel(appointment,appointment,"owner","owner",100)!!
        assertTrue(coordinator.communicate(canceled,"owner","owner",business,contact,state,state,100){_,_->error("disabled")}.isEmpty())
        assertTrue(canceled.snapshot.booking.canceled)
    }
    @Test fun concurrentCommunicationAndPartialHistoryFailure() {
        val dir = folder.root
        val coordinator = CancellationIntegrationPreview(dir)
        val canceled = coordinator.cancel(appointment,appointment,"owner","owner",100)!!
        val controls = BusinessCommunicationControlsPreview(dir)
        assertTrue(controls.change("owner","owner",controls.read("owner","owner")!!,true,false,false,false,50))
        val historyFile = java.io.File(dir,"communication-history-v1.state")
        historyFile.writeText("corrupt")
        val calls = java.util.concurrent.atomic.AtomicInteger()
        val pool = java.util.concurrent.Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { java.util.concurrent.Callable {
                coordinator.communicate(canceled,"owner","owner",business,contact,state,state,100) { _,_ ->
                    calls.incrementAndGet()
                    CommunicationRecoveryPreview.Response.ACCEPTED
                }
            } }).map { it.get() }
            assertEquals(1,calls.get())
            assertTrue(results.all { it[email]?.trackingSaved == false })
        } finally { pool.shutdownNow() }
        assertTrue(historyFile.delete())
        val repaired = coordinator.communicate(canceled,"owner","owner",business,contact,state,state,200){_,_->error("duplicate")}
        assertTrue(repaired[email]!!.trackingSaved)
        assertEquals(1,calls.get())
    }
    @Test fun emergencyWithdrawalAndScheduleCorruption() {
        val dir = folder.root
        val coordinator = CancellationIntegrationPreview(dir)
        val canceled = coordinator.cancel(appointment,appointment,"owner","owner",100)!!
        val controls = BusinessCommunicationControlsPreview(dir)
        assertTrue(controls.change("owner","owner",controls.read("owner","owner")!!,true,true,false,true,50))
        assertTrue(coordinator.communicate(canceled,"owner","owner",business,contact,state,state,100){_,_->error("emergency")}.isEmpty())
        assertTrue(ReminderSchedulePreview(dir).cancellationRecorded(canceled.snapshot,"owner","owner"))
        assertFalse(ReminderSchedulePreview(dir).cancellationRecorded(canceled.snapshot,"other","other"))
        assertTrue(controls.change("owner","owner",controls.read("owner","owner")!!,true,true,false,false,60))
        val withdrawn = state.copy(revision=3,email=CommunicationPreferencesPreview.Choice(false,70),whatsapp=CommunicationPreferencesPreview.Choice(false,70))
        assertTrue(coordinator.communicate(canceled,"owner","owner",business,contact,state,withdrawn,100){_,_->error("withdrawn")}.isEmpty())
        java.io.File(dir,"reminder-schedule-v1.state").writeText("corrupt")
        assertTrue(coordinator.communicate(canceled,"owner","owner",business,contact,state,state,100){_,_->error("corrupt schedule")}.isEmpty())
    }
}

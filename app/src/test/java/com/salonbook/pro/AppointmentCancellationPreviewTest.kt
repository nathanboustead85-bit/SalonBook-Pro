package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class AppointmentCancellationPreviewTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",1,true,false,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",10000000L)
    private val appointment = AppointmentCancellationPreview.Appointment(snapshot,"staff",11000000L)
    private val consent = NotificationPreferences.CustomerConsent("customer",true,true,1L)
    private fun cancel(c: NotificationPreferences.CustomerConsent? = consent) =
        AppointmentCancellationPreview.cancel(appointment,appointment,"owner","owner",c,"+447000000000",100L)!!
    @Test fun cancellationReleasesSlotAndInvalidatesReminders() {
        val plan = cancel()
        assertTrue(plan.canceled.snapshot.booking.canceled)
        assertEquals(2L,plan.canceled.snapshot.booking.revision)
        assertFalse(AppointmentCancellationPreview.slotAvailable(listOf(appointment),"owner","staff",10000000,11000000))
        assertTrue(AppointmentCancellationPreview.slotAvailable(listOf(plan.canceled),"owner","staff",10000000,11000000))
        assertFalse(AppointmentCancellationPreview.slotAvailable(listOf(plan.canceled,appointment.copy(snapshot=snapshot.copy(booking=booking.copy(bookingId="other")))),"owner","staff",10000000,11000000))
        val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled=true,reminder2HoursEnabled=true)
        assertTrue(SecureReminderPlan.windows(plan.canceled.snapshot,plan.canceled.snapshot,"owner","owner",consent,settings,100L).isEmpty())
        assertTrue(SecureReminderPlan.windows(snapshot,plan.canceled.snapshot,"owner","owner",consent,settings,100L).isEmpty())
    }
    @Test fun channelsAreIndependentAndKeysStable() {
        val plan = cancel()
        assertEquals(2,plan.notifications.size)
        assertEquals(2,plan.notifications.map { it.key }.toSet().size)
        assertEquals(plan.notifications,cancel().notifications)
        assertEquals(listOf(AppointmentCancellationPreview.Channel.EMAIL),cancel(consent.copy(whatsappContactAllowed=false)).notifications.map { it.channel })
        assertTrue(cancel(null).notifications.isEmpty())
        assertTrue(cancel(consent.copy(customerId="other")).notifications.isEmpty())
        assertTrue(cancel(consent.copy(consentWithdrawnAtMillis=50)).notifications.isEmpty())
    }
    @Test fun authorizationAndDeletionGuards() {
        val canceled = cancel().canceled
        assertNull(AppointmentCancellationPreview.cancel(appointment,appointment,"other","other",consent,null,100))
        assertNull(AppointmentCancellationPreview.cancel(appointment,canceled,"owner","owner",consent,null,100))
        assertNull(AppointmentCancellationPreview.cancel(canceled,canceled,"owner","owner",consent,null,100))
        assertFalse(AppointmentCancellationPreview.canDeleteRecord(appointment,"owner","owner",true,true))
        assertFalse(AppointmentCancellationPreview.canDeleteRecord(canceled,"owner","owner",true,false))
        assertFalse(AppointmentCancellationPreview.canDeleteRecord(canceled,"owner","owner",false,true))
        assertTrue(AppointmentCancellationPreview.canDeleteRecord(canceled,"owner","owner",true,true))
    }
}

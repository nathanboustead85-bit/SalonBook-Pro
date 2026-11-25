package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerCommunicationPolicyTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",10000000)
    private val contact = CustomerCommunicationPolicy.Contact("customer","test@example.invalid","+447000000000")
    private val consent = NotificationPreferences.CustomerConsent("customer",true,true,1)
    private fun eligible(s: SecureReminderPlan.Snapshot = snapshot, c: CustomerCommunicationPolicy.Contact = contact,
        p: NotificationPreferences.CustomerConsent = consent, owner: String = "owner") =
        CustomerCommunicationPolicy.eligible(s,owner,owner,c,p,100)
    @Test fun independentChannels() {
        assertEquals(2,eligible().size)
        assertEquals(setOf(AppointmentCancellationPreview.Channel.EMAIL),eligible(c=contact.copy(phone="invalid")))
        assertEquals(setOf(AppointmentCancellationPreview.Channel.WHATSAPP),eligible(c=contact.copy(email="other@example.invalid")))
        assertEquals(setOf(AppointmentCancellationPreview.Channel.EMAIL),eligible(p=consent.copy(whatsappContactAllowed=false)))
    }
    @Test fun rejectsWrongOwnerCustomerAndConsent() {
        assertTrue(eligible(owner="other").isEmpty())
        assertTrue(eligible(c=contact.copy(customerId="other")).isEmpty())
        assertTrue(eligible(p=consent.copy(customerId="other")).isEmpty())
        assertTrue(eligible(p=consent.copy(consentRecordedAtMillis=101)).isEmpty())
        assertTrue(eligible(p=consent.copy(consentWithdrawnAtMillis=50)).isEmpty())
        assertTrue(eligible(s=snapshot.copy(booking=booking.copy(canceled=false))).isEmpty())
    }
}

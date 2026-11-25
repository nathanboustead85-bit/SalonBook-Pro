package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CancellationMessageTemplateTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","private-booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"private-customer",1795622400000L)
    private val contact = CustomerCommunicationPolicy.Contact("private-customer","test@example.invalid","+447000000000")
    private val consent = NotificationPreferences.CustomerConsent("private-customer",true,true,1)
    private val business = CancellationMessageTemplate.Business("owner","Demo Salon","demo-salon","Europe/London")
    private fun render(b: CancellationMessageTemplate.Business = business, channel: AppointmentCancellationPreview.Channel = AppointmentCancellationPreview.Channel.EMAIL, c: NotificationPreferences.CustomerConsent = consent) =
        CancellationMessageTemplate.render(snapshot,"owner","owner",b,contact,c,channel,100)
    @Test fun professionalMessagesWithoutPrivateIdentifiers() {
        val email = render()!!
        assertEquals("Appointment cancellation - Demo Salon",email.subject)
        assertTrue(email.body.contains("has been cancelled"))
        assertTrue(email.body.contains("https://boustio.co.uk/book/demo-salon"))
        assertTrue(email.body.contains("November 2026"))
        listOf("private-booking","private-customer","test@example.invalid","+447000000000").forEach { assertFalse(email.body.contains(it)) }
        val whatsapp = render(channel=AppointmentCancellationPreview.Channel.WHATSAPP)!!
        assertNull(whatsapp.subject)
        assertEquals(email.body,whatsapp.body)
    }
    @Test fun invalidBusinessAndConsentRejected() {
        listOf("../other","https://evil.example","demo?customer=1","demo/other","demo#x").forEach { assertNull(render(b=business.copy(slug=it))) }
        assertNull(render(b=business.copy(name="Salon\nBcc: other@example.invalid")))
        assertNull(render(b=business.copy(ownerId="other")))
        assertNull(render(b=business.copy(zone="invalid")))
        assertNull(render(c=consent.copy(emailNotificationsAllowed=false)))
        assertNull(render(channel=AppointmentCancellationPreview.Channel.WHATSAPP,c=consent.copy(whatsappContactAllowed=false)))
    }
}

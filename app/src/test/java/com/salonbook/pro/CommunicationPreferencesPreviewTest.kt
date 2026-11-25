package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CommunicationPreferencesPreviewTest {
    private val initial = CommunicationPreferencesPreview.State("owner","customer")
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",1795622400000L)
    private val contact = CustomerCommunicationPolicy.Contact("customer","test@example.invalid","+447000000000")
    private val email = AppointmentCancellationPreview.Channel.EMAIL
    private val whatsapp = AppointmentCancellationPreview.Channel.WHATSAPP
    private val enabled = CommunicationPreferencesPreview.Controls(true,true)
    private fun change(s: CommunicationPreferencesPreview.State, channel: AppointmentCancellationPreview.Channel, allowed: Boolean, now: Long) =
        CommunicationPreferencesPreview.change(s,s,"customer","owner",channel,allowed,now)!!
    private fun eligible(s: CommunicationPreferencesPreview.State, controls: CommunicationPreferencesPreview.Controls = enabled) =
        CommunicationPreferencesPreview.eligible(snapshot,"owner","owner",contact,s,s,100)
    @Test fun defaultsAndIndependentWithdrawal() {
        assertTrue(eligible(initial).isEmpty())
        val first = change(initial,email,true,10)
        assertEquals(setOf(email),eligible(first))
        val both = change(first,whatsapp,true,20)
        assertEquals(setOf(email,whatsapp),eligible(both))
        val withdrawn = change(both,email,false,30)
        assertEquals(setOf(whatsapp),eligible(withdrawn))
        assertTrue(eligible(withdrawn,CommunicationPreferencesPreview.Controls()).isEmpty())
        assertEquals(setOf(email),eligible(both,CommunicationPreferencesPreview.Controls(true,false)))
        assertEquals(setOf(email,whatsapp),eligible(change(withdrawn,email,true,40)))
    }
    @Test fun staleAndUnauthorizedChangesRejected() {
        val current = change(initial,email,true,10)
        assertNull(CommunicationPreferencesPreview.change(initial,current,"customer","owner",email,false,20))
        assertNull(CommunicationPreferencesPreview.change(current,current,"other","owner",email,false,20))
        assertNull(CommunicationPreferencesPreview.change(current,current,"customer","other",email,false,20))
        assertNull(CommunicationPreferencesPreview.change(current,current,"customer","owner",email,false,10))
        assertTrue(CommunicationPreferencesPreview.eligible(snapshot,"owner","owner",contact,initial,current,enabled,100).isEmpty())
        assertTrue(eligible(current.copy(businessId="other")).isEmpty())
        assertTrue(eligible(current.copy(customerId="other")).isEmpty())
        assertTrue(eligible(change(current,whatsapp,true,101),CommunicationPreferencesPreview.Controls(false,true)).isEmpty())
    }
}

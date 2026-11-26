package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class SlotRecoveryPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val slot=WaitingListPreview.Slot("b","booking","cut","staff",10000000,12000000)
    private val booking=NotificationSafetyPolicy.BookingSnapshot("b","booking",1,true,false,"test@example.invalid",true,true)
    private val appointment=AppointmentCancellationPreview.Appointment(SecureReminderPlan.Snapshot(booking,"other",slot.start),"staff",slot.end)
    private val canceled=AppointmentCancellationPreview.cancel(appointment,appointment,"b","b",null,null,100)!!.canceled
    private val request=WaitingListPreview.Request("b","a","c","cut",null,slot.start,slot.end,600000,100,9000000)
    private val waiting=WaitingListPreview.Ledger("b",1,listOf(request,request.copy(id="b",customerId="d",createdAt=101)))
    private val initial=SlotRecoveryPreview.State(slot,1,emptyList())
    private fun advance(s:SlotRecoveryPreview.State=initial,current:SlotRecoveryPreview.State=s,now:Long=200,
        appointments:List<AppointmentCancellationPreview.Appointment> = listOf(canceled),minutes:Int=5)=
        SlotRecoveryPreview.advance(owner,"o","b",s,current,waiting,waiting,canceled,appointments,now,minutes)
    private fun respond(s:SlotRecoveryPreview.State,customer:String="c",accept:Boolean=true,now:Long=201,
        appointments:List<AppointmentCancellationPreview.Appointment> = listOf(canceled))=
        SlotRecoveryPreview.respond(owner,"o","b",s,s,waiting,waiting,canceled,appointments,customer,"a",accept,now)
    @Test fun expiryAndNextCustomer() {
        val first=advance()!!
        assertEquals("c",first.offers.single().customerId)
        assertTrue(SlotRecoveryPreview.protected(first,201))
        assertNull(advance(first,now=201))
        assertNull(advance(current=first))
        assertNull(respond(first,customer="d"))
        assertNull(respond(first,now=300200))
        val next=advance(first,now=300200)!!
        assertEquals(SlotRecoveryPreview.Status.EXPIRED,next.offers.first().status)
        assertEquals("d",next.offers.last().customerId)
        assertNull(advance(minutes=0))
    }
    @Test fun acceptanceDeclineAndOverlap() {
        val first=advance()!!
        val accepted=respond(first)!!
        assertTrue(SlotRecoveryPreview.protected(accepted,400000))
        assertNull(advance(accepted,now=400000))
        assertNull(respond(accepted))
        assertNull(respond(first,appointments=listOf(canceled,appointment)))
        assertNull(advance(appointments=listOf(canceled,appointment)))
        val declined=respond(first,accept=false)!!
        assertEquals("d",advance(declined,now=202)!!.offers.last().customerId)
    }
}

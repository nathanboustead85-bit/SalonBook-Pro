package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class WaitingListPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val now=100L
    private val request=WaitingListPreview.Request("b","r","c","cut",null,10000000,11000000,600000,now,200)
    private val ledger=WaitingListPreview.Ledger("b",1,emptyList())
    private val booking=NotificationSafetyPolicy.BookingSnapshot("b","booking",1,true,false,"test@example.invalid",true,true)
    private val appointment=AppointmentCancellationPreview.Appointment(SecureReminderPlan.Snapshot(booking,"other",10000000L),"staff",11000000L)
    private val canceled=AppointmentCancellationPreview.cancel(appointment,appointment,"b","b",null,null,now)!!.canceled
    private val slot=WaitingListPreview.Slot("b","booking","cut","staff",10000000,11000000)
    private fun add(r:WaitingListPreview.Request=request,l:WaitingListPreview.Ledger=ledger)=WaitingListPreview.add(owner,"o","b",l,l,r,now)
    private fun match(l:WaitingListPreview.Ledger=add()!!,s:WaitingListPreview.Slot=slot,
        a:AppointmentCancellationPreview.Appointment=canceled,appointments:List<AppointmentCancellationPreview.Appointment> = listOf(canceled),at:Long=now)=
        WaitingListPreview.match(owner,"o","b",l,l,s,a,appointments,at)
    @Test fun requestsAndDuplicates() {
        val l=add()!!
        assertEquals(2L,l.revision)
        assertTrue(ledger.requests.isEmpty())
        assertNull(add(request.copy(id="second"),l))
        assertNull(add(request.copy(businessId="other")))
        assertNull(add(request.copy(expiresAt=now)))
        assertNull(add(request.copy(durationMillis=2000000)))
        assertNull(WaitingListPreview.add(owner,"o","b",ledger,l,request,now))
        assertNull(WaitingListPreview.add(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",ledger,ledger,request,now))
    }
    @Test fun cancellationMatching() {
        assertEquals(listOf("r"),match())
        assertTrue(match(at=200)!!.isEmpty())
        assertTrue(match(s=slot.copy(serviceId="other"))!!.isEmpty())
        assertTrue(match(l=add(request.copy(staffId="other"))!!)!!.isEmpty())
        assertTrue(match(l=add(request.copy(preferredFrom=10500000,preferredUntil=11500000))!!)!!.isEmpty())
        assertNull(match(a=appointment))
        assertNull(match(appointments=listOf(canceled,appointment)))
        assertNull(match(s=slot.copy(businessId="other")))
        val l=add(request.copy(id="second",customerId="new"),add()!!)!!
        assertEquals(listOf("r","second"),match(l=l))
    }
}

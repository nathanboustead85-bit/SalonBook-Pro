package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class AppointmentGapPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val minute=60000L
    private val from=10000000L
    private fun t(m:Int)=from+m*minute
    private fun w(a:Int,b:Int)=OccupancyReportPreview.Window("b","staff",t(a),t(b))
    private fun ap(a:Int,b:Int,id:String="a",staff:String="staff",customer:String="other",canceled:Boolean=false)=
        OccupancyReportPreview.Appointment(CustomerAppointmentHistoryPreview.Entry("b",customer,id,t(a),"cut",staff,2000,
            if(canceled) CustomerAppointmentHistoryPreview.Status.CANCELED else CustomerAppointmentHistoryPreview.Status.BOOKED),t(b))
    private val s=AppointmentGapPreview.Snapshot("b",1,listOf(w(0,180)),listOf(w(60,90)),listOf(ap(30,60),ap(120,150,"b")),emptyList(),emptyList())
    private fun rank(x:AppointmentGapPreview.Snapshot=s,current:AppointmentGapPreview.Snapshot=x,
        member:EmployeeAccessPreview.Membership=owner,minutes:Int=30)=
        AppointmentGapPreview.rank(member,"o","b",x,current,"staff","c",minutes,from,t(180),from-1)
    @Test fun exactFitsAndPrivacy() {
        val result=rank()!!
        assertEquals(listOf(t(0),t(90),t(150)),result.map{it.start})
        assertTrue(result.all{it.unusedMillis==0L})
        assertTrue(rank(minutes=31)!!.isEmpty())
        assertNull(rank(current=s.copy(revision=2)))
        assertNull(rank(member=owner.copy(businessId="other")))
        assertNull(rank(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
        assertEquals(result,rank(s.copy(appointments=s.appointments+ap(0,30,"foreign").let{it.copy(entry=it.entry.copy(businessId="other"))})))
        assertEquals(result,rank(s.copy(appointments=s.appointments+ap(0,30,"cancel",canceled=true))))
    }
    @Test fun holdsAbsencesAndCustomerConflicts() {
        val hold=SlotRecoveryPreview.State(WaitingListPreview.Slot("b","cancel","cut","staff",t(90),t(120)),1,
            listOf(SlotRecoveryPreview.Offer("r","other",from-100,from+100,SlotRecoveryPreview.Status.PENDING)))
        val recurring=RecurringAppointmentPreview.Occurrence("b","series",0,"c","cut","other",t(150),t(180))
        assertEquals(listOf(t(0)),rank(s.copy(holds=listOf(hold),recurring=listOf(recurring)))!!.map{it.start})
        assertEquals(listOf(t(90),t(150)),rank(s.copy(appointments=s.appointments+ap(0,30,"customer","other","c")))!!.map{it.start})
        assertTrue(rank(s.copy(blocked=listOf(w(0,180))))!!.isEmpty())
        assertNull(rank(s.copy(appointments=s.appointments+s.appointments.first())))
        val wide=s.copy(working=listOf(w(0,180)),blocked=emptyList(),appointments=listOf(ap(30,60)))
        assertEquals(t(0),rank(wide)!!.first().start)
    }
}

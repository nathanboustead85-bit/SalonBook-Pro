package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class LoyaltyProgrammePreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val p=LoyaltyProgrammePreview.Programme("b",1,true,LoyaltyProgrammePreview.Mode.VISITS,startsAt=100)
    private fun entry(id:String,time:Long=200,price:Long=1250,business:String="b",
        status:CustomerAppointmentHistoryPreview.Status=CustomerAppointmentHistoryPreview.Status.COMPLETED)=
        CustomerAppointmentHistoryPreview.Entry(business,"c",id,time,"cut","staff",price,status)
    private val rows=listOf(entry("a"),entry("b",300,price=2099),entry("old",99),
        entry("cancel",status=CustomerAppointmentHistoryPreview.Status.CANCELED),
        entry("booked",status=CustomerAppointmentHistoryPreview.Status.BOOKED),entry("foreign",business="other"))
    private fun calc(programme:LoyaltyProgrammePreview.Programme=p,records:List<CustomerAppointmentHistoryPreview.Entry> = rows)=
        LoyaltyProgrammePreview.calculate(owner,"o","b",programme,programme,records,400)
    @Test fun visitAndPointsBalances() {
        assertEquals(2L,calc()!!.single().units)
        assertEquals(listOf("a","b"),calc()!!.single().credits.map{it.bookingId})
        assertEquals(4L,calc(p.copy(unitsPerVisit=2))!!.single().units)
        assertEquals(66L,calc(p.copy(mode=LoyaltyProgrammePreview.Mode.POINTS,pointsPerPound=2))!!.single().units)
        assertEquals(calc(),calc())
        assertNull(calc(records=rows+rows.first()))
        assertNull(calc(records=listOf(entry("future",401))))
        assertNull(calc(p.copy(enabled=false)))
        assertNull(calc(p.copy(pointsPerPound=0)))
        assertNull(calc(p.copy(mode=LoyaltyProgrammePreview.Mode.POINTS,pointsPerPound=100),listOf(entry("x",price=Long.MAX_VALUE),entry("y",price=1))))
    }
    @Test fun privacyAndStaleProgramme() {
        assertNull(LoyaltyProgrammePreview.calculate(owner,"other","b",p,p,rows,400))
        assertNull(LoyaltyProgrammePreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",p,p,rows,400))
        assertNull(LoyaltyProgrammePreview.calculate(owner,"o","b",p,p.copy(revision=2),rows,400))
        assertNull(LoyaltyProgrammePreview.calculate(owner,"o","other",p,p,rows,400))
    }
}

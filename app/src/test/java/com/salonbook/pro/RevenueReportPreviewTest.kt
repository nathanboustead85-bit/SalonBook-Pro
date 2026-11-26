package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class RevenueReportPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private fun entry(id:String,at:Long,price:Long,status:CustomerAppointmentHistoryPreview.Status,business:String="b")=
        CustomerAppointmentHistoryPreview.Entry(business,"c",id,at,"cut","staff",price,status)
    private val completed=CustomerAppointmentHistoryPreview.Status.COMPLETED
    private val booked=CustomerAppointmentHistoryPreview.Status.BOOKED
    private val canceled=CustomerAppointmentHistoryPreview.Status.CANCELED
    private fun report(rows:List<CustomerAppointmentHistoryPreview.Entry>)=
        RevenueReportPreview.calculate(owner,"o","b",rows,100,300,200)
    @Test fun separatesValuesAndRespectsBoundaries() {
        val rows=listOf(entry("a",100,2000,completed),entry("b",200,3000,booked),
            entry("c",150,4000,canceled),entry("d",199,5000,booked),
            entry("e",300,6000,booked),entry("f",99,7000,completed),
            entry("g",150,8000,completed,"other"))
        assertEquals(RevenueReportPreview.Report(2000,3000,4000,5000,1,1,1,1),report(rows))
        assertEquals(7,rows.size)
        assertEquals(RevenueReportPreview.Report(0,0,0,0,0,0,0,0),report(emptyList()))
    }
    @Test fun rejectsUnauthorizedOrInvalidInput() {
        val rows=listOf(entry("a",100,2000,completed))
        assertNull(RevenueReportPreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.MANAGER),"o","b",rows,100,300,200))
        assertNull(RevenueReportPreview.calculate(owner,"other","b",rows,100,300,200))
        assertNull(RevenueReportPreview.calculate(owner,"o","other",rows,100,300,200))
        assertNull(RevenueReportPreview.calculate(owner,"o","b",rows,300,100,200))
        assertNull(report(rows+rows))
        assertNull(report(listOf(entry("a",100,-1,completed))))
        assertNull(report(listOf(entry("a",201,1,completed))))
        assertNull(report(listOf(entry("a",100,Long.MAX_VALUE,completed),entry("b",101,1,completed))))
    }
}

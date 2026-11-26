package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class EmployeeReportPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val range=ReportingPeriodPreview.Range(100,300)
    private val completed=CustomerAppointmentHistoryPreview.Status.COMPLETED
    private fun row(id:String,staff:String,price:Long,business:String="b",at:Long=150,status:CustomerAppointmentHistoryPreview.Status=completed)=
        CustomerAppointmentHistoryPreview.Entry(business,"c",id,at,"cut",staff,price,status)
    private fun report(rows:List<CustomerAppointmentHistoryPreview.Entry>)=EmployeeReportPreview.calculate(owner,"o","b",rows,range,200)
    @Test fun employeeBreakdown() {
        val rows=listOf(row("1","a",2000),row("2","a",4000),row("3","b",4000),
            row("4","b",1000,at=250,status=CustomerAppointmentHistoryPreview.Status.BOOKED),
            row("5","a",500,status=CustomerAppointmentHistoryPreview.Status.CANCELED),
            row("6","other",99999,"other"),row("7","a",99999,at=300,status=CustomerAppointmentHistoryPreview.Status.BOOKED))
        val result=report(rows)!!
        assertEquals(listOf("a","b"),result.map{it.staffKey})
        assertEquals(6000L,result[0].totals.completedValuePence)
        assertEquals("3000.00",result[0].averageCompletedPence.toString())
        assertEquals("60.00",result[0].contributionPercent.toString())
        assertEquals("40.00",result[1].contributionPercent.toString())
        assertEquals(1000L,result[1].totals.upcomingValuePence)
        assertEquals(500L,result[0].totals.canceledValuePence)
        assertEquals(7,rows.size)
    }
    @Test fun privacyAndInvalidRecords() {
        val rows=listOf(row("1","a",100))
        assertNull(EmployeeReportPreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",rows,range,200))
        assertNull(EmployeeReportPreview.calculate(owner,"other","b",rows,range,200))
        assertNull(report(rows+rows))
        assertNull(report(listOf(row("1","",100))))
        assertNull(report(listOf(row("1","a",Long.MAX_VALUE),row("2","b",1))))
        assertTrue(report(emptyList())!!.isEmpty())
        val zero=report(listOf(row("1","a",0)))!!.single()
        assertNull(zero.contributionPercent)
        assertEquals("0.00",zero.averageCompletedPence.toString())
    }
}

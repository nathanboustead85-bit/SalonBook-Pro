package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class ServiceReportPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val range=ReportingPeriodPreview.Range(100,300)
    private val completed=CustomerAppointmentHistoryPreview.Status.COMPLETED
    private fun row(id:String,service:String,price:Long,business:String="b",at:Long=150,status:CustomerAppointmentHistoryPreview.Status=completed)=
        CustomerAppointmentHistoryPreview.Entry(business,"c",id,at,service,"staff",price,status)
    private fun report(rows:List<CustomerAppointmentHistoryPreview.Entry>)=ServiceReportPreview.calculate(owner,"o","b",rows,range,200)
    @Test fun breakdown() {
        val rows=listOf(row("1","cut",2000),row("2","cut",4000),row("3","colour",4000),
            row("4","cut",1000,at=250,status=CustomerAppointmentHistoryPreview.Status.BOOKED),
            row("5","cut",500,status=CustomerAppointmentHistoryPreview.Status.CANCELED),
            row("6","other",99999,"other"),row("7","cut",99999,at=300,status=CustomerAppointmentHistoryPreview.Status.BOOKED))
        val result=report(rows)!!
        assertEquals(listOf("cut","colour"),result.map{it.serviceKey})
        assertEquals(6000L,result[0].totals.completedValuePence)
        assertEquals(2,result[0].totals.completedCount)
        assertEquals(4,result[0].appointmentCount)
        assertEquals("3000.00",result[0].averageCompletedPence.toString())
        assertEquals("60.00",result[0].contributionPercent.toString())
        assertEquals("25.00",result[0].cancellationPercent.toString())
        assertEquals("0.00",result[1].cancellationPercent.toString())
        assertEquals(7,rows.size)
    }
    @Test fun privacyAndInvalidRecords() {
        val rows=listOf(row("1","cut",100))
        assertNull(ServiceReportPreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.MANAGER),"o","b",rows,range,200))
        assertNull(ServiceReportPreview.calculate(owner,"other","b",rows,range,200))
        assertNull(report(rows+rows))
        assertNull(report(listOf(row("1","",100))))
        assertNull(report(listOf(row("1","cut",Long.MAX_VALUE),row("2","colour",1))))
        assertTrue(report(emptyList())!!.isEmpty())
        val canceled=report(listOf(row("1","cut",100,status=CustomerAppointmentHistoryPreview.Status.CANCELED)))!!.single()
        assertNull(canceled.averageCompletedPence)
        assertNull(canceled.contributionPercent)
        assertEquals("100.00",canceled.cancellationPercent.toString())
    }
}

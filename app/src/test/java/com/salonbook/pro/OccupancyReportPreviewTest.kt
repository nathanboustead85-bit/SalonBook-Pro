package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class OccupancyReportPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val range=ReportingPeriodPreview.Range(3600000,18000000)
    private val windows=listOf(OccupancyReportPreview.Window("b","s",3600000,18000000))
    private fun ap(id:String,start:Long,end:Long,status:CustomerAppointmentHistoryPreview.Status=CustomerAppointmentHistoryPreview.Status.BOOKED,business:String="b")=
        OccupancyReportPreview.Appointment(CustomerAppointmentHistoryPreview.Entry(business,"c",id,start,"cut","s",2000,status),end)
    private fun report(a:List<OccupancyReportPreview.Appointment>,w:List<OccupancyReportPreview.Window> = windows)=
        OccupancyReportPreview.calculate(owner,"o","b",w,a,range,3600000,"UTC")
    @Test fun overlapAndCancellation() {
        val rows=listOf(ap("1",3600000,10800000),ap("2",7200000,14400000),
            ap("3",14400000,18000000,CustomerAppointmentHistoryPreview.Status.CANCELED),
            ap("4",3600000,18000000,business="other"))
        val result=report(rows,windows+windows)!!
        assertEquals(14400000L,result.availableMillis)
        assertEquals(10800000L,result.bookedMillis)
        assertEquals(3600000L,result.unusedMillis)
        assertEquals("75.00",result.utilisation.toString())
        assertEquals("33.33",result.cancellationPercent.toString())
        assertEquals(2000L,result.canceledValuePence)
        assertEquals(mapOf(1 to 3600000L,2 to 3600000L,3 to 3600000L),result.bookedByLocalHour)
    }
    @Test fun privacyAndInvalidCapacity() {
        val rows=listOf(ap("1",3600000,7200000))
        assertNull(OccupancyReportPreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",windows,rows,range,3600000))
        assertNull(report(rows+rows))
        assertNull(report(rows,emptyList()))
        assertNull(report(listOf(ap("1",3600000,3600000))))
        assertNull(report(emptyList(),emptyList())!!.utilisation)
        assertEquals("0.00",report(emptyList())!!.utilisation.toString())
    }
}

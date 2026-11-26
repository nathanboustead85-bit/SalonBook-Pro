package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class BusinessInsightsPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val hour=3600000L
    private val day=24*hour
    private val from=1800000000000L
    private val range=ReportingPeriodPreview.Range(from,from+28*day)
    private val now=range.until+day
    private val windows=(0..27).map{OccupancyReportPreview.Window("b","staff",from+it*day,from+it*day+8*hour)}
    private val records=(0..19).map{
        val start=from+it*day
        OccupancyReportPreview.Appointment(CustomerAppointmentHistoryPreview.Entry("b","customer"+it,"booking"+it,start,"cut","staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED),start+hour)
    }
    private fun analyse(r:List<OccupancyReportPreview.Appointment> = records,member:EmployeeAccessPreview.Membership=owner)=
        BusinessInsightsPreview.analyse(member,"o","b",r,windows,range,now)
    @Test fun aggregateAndIllustrativeValue() {
        val result=analyse()!!
        assertTrue(result.sufficientData)
        assertEquals(40000L,result.completedValuePence)
        assertTrue(result.insights.any{it.kind==BusinessInsightsPreview.Kind.STAFF_UTILISATION})
        assertTrue(result.insights.any{it.kind==BusinessInsightsPreview.Kind.QUIET_HOUR})
        assertEquals(2000L,result.insights.single{it.kind==BusinessInsightsPreview.Kind.POPULAR_SERVICE}.illustrativeValuePence)
        assertTrue(result.insights.none{it.key.startsWith("customer")})
        assertEquals(result,analyse(records+records.first().let{it.copy(entry=it.entry.copy(businessId="foreign"))}))
    }
    @Test fun insufficientAndUnauthorized() {
        assertFalse(analyse(records.take(19))!!.sufficientData)
        assertTrue(analyse(emptyList())!!.insights.isEmpty())
        assertNull(analyse(records+records.first()))
        assertNull(analyse(member=owner.copy(businessId="other")))
        assertNull(analyse(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
    }
}

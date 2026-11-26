package com.salonbook.pro

import java.math.BigDecimal
import java.math.RoundingMode

internal object ServiceReportPreview {
    data class Row(val serviceKey:String,val totals:RevenueReportPreview.Report,
        val averageCompletedPence:BigDecimal?,val contributionPercent:BigDecimal?,
        val cancellationPercent:BigDecimal?,val appointmentCount:Int)
    private fun ratio(n:Long,d:Long,scale:Long):BigDecimal? =
        if(d==0L) null else BigDecimal.valueOf(n).multiply(BigDecimal.valueOf(scale))
            .divide(BigDecimal.valueOf(d),2,RoundingMode.HALF_UP)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,range:ReportingPeriodPreview.Range,now:Long):List<Row>? {
        val total=RevenueReportPreview.calculate(owner,actor,business,records,range.from,range.until,now) ?: return null
        val scoped=records.filter { it.businessId==business && it.startsAt>=range.from && it.startsAt<range.until }
        if(scoped.any { it.service.isBlank() }) return null
        return scoped.groupBy { it.service }.map { (service,entries) ->
            val t=RevenueReportPreview.calculate(owner,actor,business,entries,range.from,range.until,now) ?: return null
            Row(service,t,ratio(t.completedValuePence,t.completedCount.toLong(),1),
                ratio(t.completedValuePence,total.completedValuePence,100),
                ratio(t.canceledCount.toLong(),entries.size.toLong(),100),entries.size)
        }.sortedWith(compareByDescending<Row>{it.totals.completedCount}.thenBy{it.serviceKey})
    }
}

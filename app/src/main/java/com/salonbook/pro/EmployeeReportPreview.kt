package com.salonbook.pro

import java.math.BigDecimal
import java.math.RoundingMode

/** Offline appointment-value reporting, not payment receipts. */
internal object EmployeeReportPreview {
    data class Row(val staffKey:String,val totals:RevenueReportPreview.Report,
        val averageCompletedPence:BigDecimal?,val contributionPercent:BigDecimal?)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,range:ReportingPeriodPreview.Range,now:Long):List<Row>? {
        val total=RevenueReportPreview.calculate(owner,actor,business,records,range.from,range.until,now) ?: return null
        val scoped=records.filter { it.businessId==business && it.startsAt>=range.from && it.startsAt<range.until }
        if(scoped.any { it.staff.isBlank() }) return null
        return scoped.groupBy { it.staff }.map { (staff,entries) ->
            val t=RevenueReportPreview.calculate(owner,actor,business,entries,range.from,range.until,now) ?: return null
            val value=BigDecimal.valueOf(t.completedValuePence)
            val average=if(t.completedCount==0) null else value.divide(BigDecimal.valueOf(t.completedCount.toLong()),2,RoundingMode.HALF_UP)
            val share=if(total.completedValuePence==0L) null else value.multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total.completedValuePence),2,RoundingMode.HALF_UP)
            Row(staff,t,average,share)
        }.sortedWith(compareByDescending<Row>{it.totals.completedValuePence}.thenBy{it.staffKey})
    }
}

package com.salonbook.pro

import java.time.LocalDate
import java.math.BigDecimal

internal object GrowthExportPreview {
    enum class Kind { BUSINESS, EMPLOYEE, SERVICE }
    data class Month(val label:String,val totals:RevenueReportPreview.Report,val growth:BigDecimal?)
    fun trends(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,first:LocalDate,count:Int,now:Long,
        zone:String="Europe/London"):List<Month>? {
        if(count !in 1..120) return null
        return try {
            val start=first.withDayOfMonth(1)
            (0 until count).map { i ->
                val date=start.plusMonths(i.toLong())
                val ranges=ReportingPeriodPreview.ranges(date,ReportingPeriodPreview.Period.MONTH,zone) ?: return null
                val current=RevenueReportPreview.calculate(owner,actor,business,records,ranges.current.from,ranges.current.until,now) ?: return null
                val previous=RevenueReportPreview.calculate(owner,actor,business,records,ranges.previous.from,ranges.previous.until,now) ?: return null
                Month(date.toString().take(7),current,ReportingPeriodPreview.growthPercent(current.completedValuePence,previous.completedValuePence))
            }
        } catch (_:RuntimeException) { null }
    }
    private fun cell(s:String):String {
        val clean=s.map { if(Character.isISOControl(it) || Character.getType(it)==Character.FORMAT.toInt()) ' ' else it }.joinToString("")
        val safe=if(clean.trimStart().firstOrNull() in listOf('=','+','-','@')) "'"+clean else clean
        return "\""+safe.replace("\"","\"\"")+"\""
    }
    fun csv(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,range:ReportingPeriodPreview.Range,
        now:Long,kind:Kind,confirmed:Boolean):String? {
        if(!confirmed) return null
        val total=RevenueReportPreview.calculate(owner,actor,business,records,range.from,range.until,now) ?: return null
        val rows=when(kind) {
            Kind.BUSINESS -> listOf("Business total" to total)
            Kind.EMPLOYEE -> EmployeeReportPreview.calculate(owner,actor,business,records,range,now)?.map{it.staffKey to it.totals} ?: return null
            Kind.SERVICE -> ServiceReportPreview.calculate(owner,actor,business,records,range,now)?.map{it.serviceKey to it.totals} ?: return null
        }
        if(rows.any{it.first.length>256}) return null
        val header="report_kind,range_start_epoch_ms,range_end_exclusive_epoch_ms,label,completed_count,completed_appointment_value_gbp,upcoming_count,upcoming_appointment_value_gbp,canceled_count,canceled_appointment_value_gbp,overdue_booked_count,overdue_booked_appointment_value_gbp"
        fun money(p:Long)=BigDecimal.valueOf(p,2).toPlainString()
        return buildString {
            append(header).append("\r\n")
            for((label,t) in rows) {
                append(listOf(kind.name,range.from,range.until,cell(label),t.completedCount,money(t.completedValuePence),
                    t.upcomingCount,money(t.upcomingValuePence),t.canceledCount,money(t.canceledValuePence),
                    t.overdueBookedCount,money(t.overdueBookedValuePence)).joinToString(",")).append("\r\n")
            }
        }
    }
}

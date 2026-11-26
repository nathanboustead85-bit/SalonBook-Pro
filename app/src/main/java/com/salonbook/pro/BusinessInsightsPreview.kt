package com.salonbook.pro

import java.math.BigDecimal
import java.math.BigInteger
import java.time.Instant
import java.time.ZoneId

internal object BusinessInsightsPreview {
    enum class Kind { STAFF_UTILISATION, QUIET_HOUR, SERVICE_REVIEW, POPULAR_SERVICE, RETENTION_REVIEW }
    data class Insight(val kind:Kind,val key:String,val count:Long,val denominator:Long,
        val illustrativeValuePence:Long?=null)
    data class Result(val sufficientData:Boolean,val completedValuePence:Long,val insights:List<Insight>)
    fun analyse(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<OccupancyReportPreview.Appointment>,windows:List<OccupancyReportPreview.Window>,
        range:ReportingPeriodPreview.Range,now:Long):Result? {
        val day=86400000L
        if(owner?.role!=EmployeeAccessPreview.Role.OWNER || range.from<=0 || range.until>now ||
            range.until<=range.from || range.until-range.from !in 14*day..90*day || now<=90*day) return null
        val entries=records.map{it.entry}
        val revenue=RevenueReportPreview.calculate(owner,actor,business,entries,range.from,range.until,now) ?: return null
        val occupancy=OccupancyReportPreview.calculate(owner,actor,business,windows,records,range,now) ?: return null
        val services=ServiceReportPreview.calculate(owner,actor,business,entries,range,now) ?: return null
        val retention=CustomerRetentionPreview.calculate(owner,actor,business,entries,range,now,now-90*day) ?: return null
        if(revenue.completedCount<20) return Result(false,revenue.completedValuePence,emptyList())
        val insights=mutableListOf<Insight>()
        val hour=3600000L
        for(s in occupancy.staff) {
            if(s.availableMillis>=20*hour && s.utilisation!=null && s.utilisation!!<BigDecimal("60")) {
                insights.add(Insight(Kind.STAFF_UTILISATION,s.staffId,s.unusedMillis,s.availableMillis))
            }
        }
        // Union per staff before measuring available local-hour exposure.
        val exposure=mutableMapOf<Int,Long>()
        val zone=ZoneId.of("Europe/London")
        for(ws in windows.filter{it.businessId==business}.groupBy{it.staffId}.values) {
            val merged=mutableListOf<Pair<Long,Long>>()
            for(w in ws.sortedBy{it.start}) {
                val a=maxOf(w.start,range.from);val z=minOf(w.end,range.until)
                if(a>=z) continue
                val last=merged.lastOrNull()
                if(last!=null && a<=last.second) merged[merged.lastIndex]=last.first to maxOf(last.second,z)
                else merged.add(a to z)
            }
            for(w in merged) {
                var s=w.first
                while(s<w.second) {
                    val local=Instant.ofEpochMilli(s).atZone(zone)
                    val boundary=local.withMinute(0).withSecond(0).withNano(0).plusHours(1).toInstant().toEpochMilli()
                    val transition=zone.rules.nextTransition(Instant.ofEpochMilli(s))?.instant?.toEpochMilli() ?: Long.MAX_VALUE
                    val end=minOf(w.second,boundary,transition)
                    if(end<=s) return null
                    exposure[local.hour]=(exposure[local.hour]?:0L)+end-s
                    s=end
                }
            }
        }
        for((h,a) in exposure) {
            val used=occupancy.bookedByLocalHour[h]?:0L
            if(a>=5*hour && used*2<a) insights.add(Insight(Kind.QUIET_HOUR,h.toString(),used,a))
        }
        for(s in services) {
            if(s.appointmentCount>=10 && s.totals.canceledCount*3>=s.appointmentCount)
                insights.add(Insight(Kind.SERVICE_REVIEW,s.serviceKey,s.totals.canceledCount.toLong(),s.appointmentCount.toLong()))
        }
        val top=services.firstOrNull()
        if(top!=null && top.totals.completedCount>=10) {
            // Illustrative value of ONE additional appointment at historical mean nominal price.
            val mean=BigInteger.valueOf(top.totals.completedValuePence).divide(BigInteger.valueOf(top.totals.completedCount.toLong())).toLong()
            insights.add(Insight(Kind.POPULAR_SERVICE,top.serviceKey,top.totals.completedCount.toLong(),revenue.completedCount.toLong(),mean))
        }
        if(retention.priorCustomers>=20 && retention.retentionPercent!=null && retention.retentionPercent!!<BigDecimal("30"))
            insights.add(Insight(Kind.RETENTION_REVIEW,"prior-customer-cohort",retention.retainedCustomers.toLong(),retention.priorCustomers.toLong()))
        val priority=listOf(Kind.STAFF_UTILISATION,Kind.QUIET_HOUR,Kind.SERVICE_REVIEW,Kind.RETENTION_REVIEW,Kind.POPULAR_SERVICE)
        return Result(true,revenue.completedValuePence,insights.sortedWith(compareBy<Insight>{priority.indexOf(it.kind)}.thenBy{it.key}).take(20))
    }
}

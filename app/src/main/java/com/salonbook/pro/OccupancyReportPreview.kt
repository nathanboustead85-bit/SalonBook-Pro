package com.salonbook.pro

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.ZoneId

internal object OccupancyReportPreview {
    data class Window(val businessId:String,val staffId:String,val start:Long,val end:Long)
    data class Appointment(val entry:CustomerAppointmentHistoryPreview.Entry,val end:Long)
    data class Staff(val staffId:String,val availableMillis:Long,val bookedMillis:Long) {
        val unusedMillis get()=availableMillis-bookedMillis
        val utilisation get()=percent(bookedMillis,availableMillis)
    }
    data class Report(val staff:List<Staff>,val availableMillis:Long,val bookedMillis:Long,
        val canceledValuePence:Long,val cancellationPercent:BigDecimal?,val bookedByLocalHour:Map<Int,Long>) {
        val unusedMillis get()=availableMillis-bookedMillis
        val utilisation get()=percent(bookedMillis,availableMillis)
    }
    private fun percent(n:Long,d:Long):BigDecimal?=if(d==0L) null else BigDecimal.valueOf(n)
        .multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(d),2,RoundingMode.HALF_UP)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        windows:List<Window>,appointments:List<Appointment>,range:ReportingPeriodPreview.Range,
        now:Long,zone:String="Europe/London"):Report? {
        if(windows.size>10000 || appointments.size>10000 || range.from<=0 || range.until<=range.from ||
            range.until-range.from>3660L*86400000L) return null
        val tz=try { ZoneId.of(zone) } catch (_:RuntimeException) { return null }
        val revenue=RevenueReportPreview.calculate(owner,actor,business,appointments.map{it.entry},range.from,range.until,now) ?: return null
        val ws=windows.filter{it.businessId==business}
        val ap=appointments.filter{it.entry.businessId==business}
        if(ws.any{it.staffId.isBlank() || it.start<=0 || it.end<=it.start} ||
            ap.any{it.entry.staff.isBlank() || it.end<=it.entry.startsAt}) return null
        fun clip(s:Long,e:Long):Pair<Long,Long>? {
            val a=maxOf(s,range.from);val z=minOf(e,range.until)
            return if(a<z) a to z else null
        }
        fun union(items:List<Pair<Long,Long>>):List<Pair<Long,Long>> {
            val result=mutableListOf<Pair<Long,Long>>()
            for(p in items.sortedBy{it.first}) {
                val last=result.lastOrNull()
                if(last!=null && p.first<=last.second) result[result.lastIndex]=last.first to maxOf(last.second,p.second)
                else result.add(p)
            }
            return result
        }
        val hours=mutableMapOf<Int,Long>()
        val rows=mutableListOf<Staff>()
        var totalAvailable=0L;var totalBooked=0L
        val active=ap.filter{it.entry.status!=CustomerAppointmentHistoryPreview.Status.CANCELED}
        for(id in (ws.map{it.staffId}+active.map{it.entry.staff}).toSortedSet()) {
            val available=union(ws.filter{it.staffId==id}.mapNotNull{clip(it.start,it.end)})
            val booked=union(active.filter{it.entry.staff==id}.mapNotNull{clip(it.entry.startsAt,it.end)})
            val a=available.sumOf{it.second-it.first};var used=0L
            for(p in booked) {
                var covered=0L
                for(w in available) {
                    var s=maxOf(p.first,w.first);val e=minOf(p.second,w.second)
                    if(s>=e) continue
                    covered+=e-s
                    while(s<e) {
                        val local=Instant.ofEpochMilli(s).atZone(tz)
                        val nextHour=local.withMinute(0).withSecond(0).withNano(0).plusHours(1).toInstant().toEpochMilli()
                        val transition=tz.rules.nextTransition(Instant.ofEpochMilli(s))?.instant?.toEpochMilli() ?: Long.MAX_VALUE
                        val end=minOf(e,nextHour,transition)
                        if(end<=s) return null
                        hours[local.hour]=(hours[local.hour]?:0L)+(end-s)
                        s=end
                    }
                }
                if(covered!=p.second-p.first) return null
                used+=covered
            }
            totalAvailable+=a;totalBooked+=used
            rows.add(Staff(id,a,used))
        }
        val count=revenue.completedCount+revenue.upcomingCount+revenue.overdueBookedCount+revenue.canceledCount
        return Report(rows,totalAvailable,totalBooked,revenue.canceledValuePence,
            percent(revenue.canceledCount.toLong(),count.toLong()),hours.toSortedMap())
    }
}

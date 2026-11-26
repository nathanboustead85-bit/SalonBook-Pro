package com.salonbook.pro

internal object AppointmentGapPreview {
    data class Snapshot(val businessId:String,val revision:Long,
        val working:List<OccupancyReportPreview.Window>,val blocked:List<OccupancyReportPreview.Window>,
        val appointments:List<OccupancyReportPreview.Appointment>,
        val recurring:List<RecurringAppointmentPreview.Occurrence>,
        val holds:List<SlotRecoveryPreview.State>)
    data class Suggestion(val staffId:String,val start:Long,val end:Long,val unusedMillis:Long)
    private fun union(items:List<Pair<Long,Long>>):List<Pair<Long,Long>> {
        val result=mutableListOf<Pair<Long,Long>>()
        for(p in items.sortedBy{it.first}) {
            val last=result.lastOrNull()
            if(last!=null && p.first<=last.second) result[result.lastIndex]=last.first to maxOf(last.second,p.second)
            else result.add(p)
        }
        return result
    }
    fun rank(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        snapshot:Snapshot,current:Snapshot,staffId:String,customerId:String,minutes:Int,
        from:Long,until:Long,now:Long,limit:Int=20):List<Suggestion>? {
        if(owner?.role!=EmployeeAccessPreview.Role.OWNER ||
            !EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            snapshot!=current || snapshot.businessId!=business || snapshot.revision<=0 ||
            staffId.isBlank() || customerId.isBlank() || minutes !in 5..720 || limit !in 1..100 ||
            now<=0 || from<=now || until<=from || until-from>31L*86400000L ||
            listOf(snapshot.working.size,snapshot.blocked.size,snapshot.appointments.size,snapshot.recurring.size,snapshot.holds.size).any{it>10000}) return null
        val windows=snapshot.working.filter{it.businessId==business}
        val blocked=snapshot.blocked.filter{it.businessId==business}
        val appointments=snapshot.appointments.filter{it.entry.businessId==business}
        val recurring=snapshot.recurring.filter{it.businessId==business}
        val holds=snapshot.holds.filter{it.slot.businessId==business}
        if((windows+blocked).any{it.staffId.isBlank() || it.start<=0 || it.end<=it.start} ||
            appointments.any{it.entry.staff.isBlank() || it.entry.customerId.isBlank() || it.entry.bookingId.isBlank() || it.entry.startsAt<=0 || it.end<=it.entry.startsAt} ||
            appointments.map{it.entry.bookingId}.toSet().size!=appointments.size ||
            recurring.any{it.staffId.isBlank() || it.customerId.isBlank() || it.start<=0 || it.end<=it.start} ||
            holds.any{it.slot.staffId.isBlank() || it.slot.start<=0 || it.slot.end<=it.slot.start}) return null
        fun clip(s:Long,e:Long):Pair<Long,Long>? {
            val a=maxOf(s,from);val z=minOf(e,until)
            return if(a<z) a to z else null
        }
        val available=union(windows.filter{it.staffId==staffId}.mapNotNull{clip(it.start,it.end)})
        val busy=union(blocked.filter{it.staffId==staffId}.mapNotNull{clip(it.start,it.end)}+
            appointments.filter{it.entry.status!=CustomerAppointmentHistoryPreview.Status.CANCELED &&
                (it.entry.staff==staffId || it.entry.customerId==customerId)}.mapNotNull{clip(it.entry.startsAt,it.end)}+
            recurring.filter{!it.canceled && (it.staffId==staffId || it.customerId==customerId)}.mapNotNull{clip(it.start,it.end)}+
            holds.filter{SlotRecoveryPreview.protected(it,now) && (it.slot.staffId==staffId ||
                it.offers.any{o->o.customerId==customerId && (o.status==SlotRecoveryPreview.Status.ACCEPTED ||
                    (o.status==SlotRecoveryPreview.Status.PENDING && now<o.deadline))})}.mapNotNull{clip(it.slot.start,it.slot.end)})
        val duration=minutes*60000L
        val result=mutableListOf<Suggestion>()
        fun gap(s:Long,e:Long) {
            if(e-s<duration) return
            val unused=e-s-duration
            result.add(Suggestion(staffId,s,s+duration,unused))
            if(unused>0) result.add(Suggestion(staffId,e-duration,e,unused))
        }
        for(w in available) {
            var cursor=w.first
            for(p in busy) {
                if(p.second<=cursor) continue
                if(p.first>=w.second) break
                gap(cursor,minOf(p.first,w.second))
                cursor=maxOf(cursor,p.second)
                if(cursor>=w.second) break
            }
            gap(cursor,w.second)
        }
        return result.distinct().sortedWith(compareBy<Suggestion>{it.unusedMillis}.thenBy{it.start}).take(limit)
    }
}

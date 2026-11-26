package com.salonbook.pro

import java.time.*

internal object RecurringAppointmentPreview {
    enum class Frequency { WEEKLY, FORTNIGHTLY, MONTHLY }
    data class Series(val businessId:String,val id:String,val customerId:String,val serviceId:String,
        val staffId:String,val first:LocalDateTime,val frequency:Frequency,val count:Int,val minutes:Int)
    data class Occurrence(val businessId:String,val seriesId:String,val index:Int,val customerId:String,
        val serviceId:String,val staffId:String,val start:Long,val end:Long,val canceled:Boolean=false)
    data class Window(val businessId:String,val staffId:String,val start:Long,val end:Long)
    data class Ledger(val businessId:String,val revision:Long,val entries:List<Occurrence>)
    private fun allowed(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?) =
        owner?.role==EmployeeAccessPreview.Role.OWNER &&
        EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS)
    private fun valid(l:Ledger,business:String?)=l.businessId==business && l.revision in 1 until Long.MAX_VALUE &&
        l.entries.size<=10000 && l.entries.all{it.businessId==business && it.seriesId.isNotBlank() &&
            it.index in 0..51 && it.customerId.isNotBlank() && it.serviceId.isNotBlank() &&
            it.staffId.isNotBlank() && it.start>0 && it.end>it.start} &&
        l.entries.map{it.seriesId to it.index}.toSet().size==l.entries.size
    private fun overlap(a:Long,b:Long,c:Long,d:Long)=a<d && c<b
    fun plan(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        series:Series,ledger:Ledger,current:Ledger,appointments:List<AppointmentCancellationPreview.Appointment>,
        working:List<Window>,absences:List<Window>,now:Long):Ledger? {
        if(!allowed(owner,actor,business) || ledger!=current || !valid(ledger,business) ||
            series.businessId!=business || listOf(series.id,series.customerId,series.serviceId,series.staffId).any{it.isBlank()} ||
            series.count !in 2..52 || series.minutes !in 5..720 || now<=0 ||
            ledger.entries.size+series.count>10000 || ledger.entries.any{it.seriesId==series.id} ||
            appointments.size>10000 || working.size>10000 || absences.size>10000 ||
            (working+absences).any{it.businessId==business && (it.start<=0 || it.end<=it.start)}) return null
        val zone=ZoneId.of("Europe/London")
        val result=mutableListOf<Occurrence>()
        for(i in 0 until series.count) {
            val local=try { when(series.frequency) {
                Frequency.WEEKLY -> series.first.plusWeeks(i.toLong())
                Frequency.FORTNIGHTLY -> series.first.plusWeeks(i*2L)
                Frequency.MONTHLY -> series.first.plusMonths(i.toLong())
            } } catch(e:RuntimeException){return null}
            val offsets=zone.rules.getValidOffsets(local)
            if(offsets.size!=1) return null
            val start=try { local.toInstant(offsets.single()).toEpochMilli() } catch(e:RuntimeException){return null}
            if(start<=now || start>Long.MAX_VALUE-series.minutes*60000L) return null
            val end=start+series.minutes*60000L
            if(!working.any{it.businessId==business && it.staffId==series.staffId && it.start<=start && it.end>=end} ||
                absences.any{it.businessId==business && it.staffId==series.staffId && overlap(start,end,it.start,it.end)} ||
                !AppointmentCancellationPreview.slotAvailable(appointments,series.businessId,series.staffId,start,end) ||
                appointments.any{it.snapshot.booking.businessId==business && !it.snapshot.booking.canceled &&
                    it.snapshot.customerId==series.customerId && overlap(start,end,it.snapshot.appointmentAtMillis,it.endMillis)} ||
                (ledger.entries+result).any{!it.canceled && (it.staffId==series.staffId || it.customerId==series.customerId) &&
                    overlap(start,end,it.start,it.end)}) return null
            result.add(Occurrence(series.businessId,series.id,i,series.customerId,series.serviceId,series.staffId,start,end))
        }
        return ledger.copy(revision=ledger.revision+1,entries=ledger.entries+result)
    }
    fun cancel(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        ledger:Ledger,current:Ledger,seriesId:String,index:Int?,now:Long,confirmed:Boolean):Ledger? {
        if(!confirmed || !allowed(owner,actor,business) || ledger!=current || !valid(ledger,business) || now<=0) return null
        val targets=ledger.entries.filter{it.seriesId==seriesId && (index==null || it.index==index) && !it.canceled && it.start>now}
        if(targets.isEmpty()) return null
        return ledger.copy(revision=ledger.revision+1,entries=ledger.entries.map{if(it in targets) it.copy(canceled=true) else it})
    }
}

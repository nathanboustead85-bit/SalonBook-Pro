package com.salonbook.pro

import java.time.*
import java.time.temporal.ChronoUnit

internal object RebookingRecommendationPreview {
    data class Event(val customerId:String,val lastBookingId:String,val at:Long)
    data class Ledger(val businessId:String,val revision:Long,val events:List<Event>)
    data class Recommendation(val customerId:String,val service:String,val staff:String,
        val intervalDays:Long,val predictedDate:LocalDate,val ledger:Ledger)
    fun propose(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,customerId:String,
        ledger:Ledger,current:Ledger,now:Long,leadDays:Int,cooldownDays:Int,
        channel:MarketingConsentPreview.Channel,recipient:String,
        consent:MarketingConsentPreview.Consent?,currentConsent:MarketingConsentPreview.Consent?,
        enabled:Boolean,suppressed:Boolean):Recommendation? {
        if(now<=365L*86400000L || now==Long.MAX_VALUE || leadDays !in 0..14 || cooldownDays !in 7..90 ||
            ledger!=current || ledger.businessId!=business || ledger.revision<=0 || ledger.revision==Long.MAX_VALUE ||
            ledger.events.size>=10000 || ledger.events.any{it.customerId.isBlank() || it.lastBookingId.isBlank() || it.at<=0 || it.at>now} ||
            ledger.events.map{it.customerId to it.lastBookingId}.toSet().size!=ledger.events.size ||
            !MarketingConsentPreview.eligible(owner,actor,business,customerId,channel,recipient,consent,currentConsent,now,enabled,suppressed)) return null
        RevenueReportPreview.calculate(owner,actor,business,records,1,now+1,now) ?: return null
        val history=records.filter{it.businessId==business && it.customerId==customerId}
        if(history.any{it.service.isBlank() || it.staff.isBlank() ||
            (it.status==CustomerAppointmentHistoryPreview.Status.BOOKED && it.startsAt>=now)}) return null
        val visits=history.filter{it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED}
            .sortedWith(compareBy<CustomerAppointmentHistoryPreview.Entry>{it.startsAt}.thenBy{it.bookingId}).takeLast(6)
        if(visits.size<3) return null
        val zone=ZoneId.of("Europe/London")
        fun date(t:Long)=Instant.ofEpochMilli(t).atZone(zone).toLocalDate()
        val last=visits.last()
        val gaps=visits.zipWithNext().map{(a,b)->ChronoUnit.DAYS.between(date(a.startsAt),date(b.startsAt))}.sorted()
        if(gaps.any{it !in 1L..365L}) return null
        val interval=(gaps[(gaps.size-1)/2]+gaps[gaps.size/2])/2
        val predicted=date(last.startsAt).plusDays(interval)
        val today=date(now)
        if(predicted.isAfter(today.plusDays(leadDays.toLong())) || predicted.isBefore(today.minusDays(30)) ||
            ledger.events.any{it.customerId==customerId && (it.lastBookingId==last.bookingId || it.at>now-cooldownDays*86400000L)}) return null
        val preferred=visits.groupBy{it.service to it.staff}.values
            .sortedWith(compareByDescending<List<CustomerAppointmentHistoryPreview.Entry>>{it.size}
                .thenByDescending{it.last().startsAt}.thenBy{it.last().bookingId}).first().last()
        return Recommendation(customerId,preferred.service,preferred.staff,interval,predicted,
            ledger.copy(revision=ledger.revision+1,events=ledger.events+Event(customerId,last.bookingId,now)))
    }
}

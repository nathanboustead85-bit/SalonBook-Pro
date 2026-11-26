package com.salonbook.pro

internal object CustomerSegmentationPreview {
    enum class Segment { NEW, REGULAR, LOYAL, HIGH_VALUE, INACTIVE }
    data class Criteria(val loyalVisits:Int=5,val highValuePence:Long=20000,val inactiveDays:Int=90)
    data class Contact(val customerId:String,val recipient:String,val candidate:MarketingConsentPreview.Consent?,
        val current:MarketingConsentPreview.Consent?,val suppressed:Boolean)
    data class Row(val customerId:String,val segments:Set<Segment>)
    fun classify(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,now:Long,criteria:Criteria=Criteria()):List<Row>? {
        if(criteria.loyalVisits !in 3..10000 || criteria.highValuePence<=0 ||
            criteria.inactiveDays !in 1..3650 || now<=criteria.inactiveDays*86400000L || now==Long.MAX_VALUE) return null
        val report=RevenueReportPreview.calculate(owner,actor,business,records,1,now+1,now) ?: return null
        val cutoff=now-criteria.inactiveDays*86400000L
        return records.filter{it.businessId==business && it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED}
            .groupBy{it.customerId}.map{(id,visits)->
                val segments=mutableSetOf<Segment>()
                if(visits.size==1) segments.add(Segment.NEW)
                else if(visits.size>=criteria.loyalVisits) segments.add(Segment.LOYAL)
                else segments.add(Segment.REGULAR)
                if(visits.sumOf{it.pricePence}>=criteria.highValuePence) segments.add(Segment.HIGH_VALUE)
                if(visits.maxOf{it.startsAt}<cutoff) segments.add(Segment.INACTIVE)
                Row(id,segments.toSet())
            }.sortedBy{it.customerId}
    }
    fun audience(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,contacts:List<Contact>,now:Long,
        channel:MarketingConsentPreview.Channel,segment:Segment?,enabled:Boolean,
        criteria:Criteria=Criteria()):List<String>? {
        val rows=classify(owner,actor,business,records,now,criteria) ?: return null
        if(contacts.size>10000 || contacts.any{it.customerId.isBlank()} ||
            contacts.map{it.customerId}.toSet().size!=contacts.size) return null
        val byId=contacts.associateBy{it.customerId}
        val eligible=rows.filter{segment==null || segment in it.segments}.mapNotNull{row->
            val c=byId[row.customerId] ?: return@mapNotNull null
            if(MarketingConsentPreview.eligible(owner,actor,business,row.customerId,channel,c.recipient,
                c.candidate,c.current,now,enabled,c.suppressed)) c else null
        }
        // Ambiguous shared destinations are excluded rather than contacted twice.
        val counts=eligible.groupingBy{it.recipient.lowercase(java.util.Locale.ROOT)}.eachCount()
        return eligible.filter{counts[it.recipient.lowercase(java.util.Locale.ROOT)]==1}.map{it.customerId}
    }
}

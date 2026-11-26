package com.salonbook.pro

internal object ReengagementPreview {
    data class Campaign(val businessId:String,val id:String,val revision:Long,val enabled:Boolean,
        val inactiveDays:Int,val cooldownDays:Int,val discountPercent:Int,val startsAt:Long,val expiresAt:Long)
    data class Event(val campaignId:String,val customerId:String,val at:Long)
    data class Ledger(val businessId:String,val revision:Long,val events:List<Event>)
    data class Proposal(val customerId:String,val discountPercent:Int,val ledger:Ledger)
    fun propose(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        campaign:Campaign?,currentCampaign:Campaign?,ledger:Ledger?,currentLedger:Ledger?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,customerId:String,now:Long,
        channel:MarketingConsentPreview.Channel,recipient:String,
        consent:MarketingConsentPreview.Consent?,currentConsent:MarketingConsentPreview.Consent?,
        marketingEnabled:Boolean,suppressed:Boolean):Proposal? {
        if(campaign==null || campaign!=currentCampaign || campaign.businessId!=business ||
            !campaign.enabled || campaign.id.isBlank() || campaign.revision<=0 ||
            campaign.inactiveDays !in 30..365 || campaign.cooldownDays !in 30..365 ||
            campaign.discountPercent !in 1..100 || campaign.startsAt<=0 ||
            campaign.expiresAt<=campaign.startsAt || now<campaign.startsAt || now>=campaign.expiresAt ||
            now<=365L*86400000L || now==Long.MAX_VALUE ||
            ledger==null || ledger!=currentLedger || ledger.businessId!=business ||
            ledger.revision<=0 || ledger.revision==Long.MAX_VALUE || ledger.events.size>=10000 ||
            ledger.events.any{it.campaignId.isBlank() || it.customerId.isBlank() || it.at<=0 || it.at>now} ||
            ledger.events.map{it.campaignId to it.customerId}.toSet().size!=ledger.events.size ||
            !MarketingConsentPreview.eligible(owner,actor,business,customerId,channel,recipient,
                consent,currentConsent,now,marketingEnabled,suppressed)) return null
        RevenueReportPreview.calculate(owner,actor,business,records,1,now+1,now) ?: return null
        val history=records.filter{it.businessId==business && it.customerId==customerId}
        val last=history.filter{it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED}
            .maxOfOrNull{it.startsAt} ?: return null
        if(last>now-campaign.inactiveDays*86400000L ||
            history.any{it.status==CustomerAppointmentHistoryPreview.Status.BOOKED && it.startsAt>=now} ||
            ledger.events.any{it.customerId==customerId && (it.campaignId==campaign.id ||
                it.at>now-campaign.cooldownDays*86400000L)}) return null
        return Proposal(customerId,campaign.discountPercent,ledger.copy(revision=ledger.revision+1,
            events=ledger.events+Event(campaign.id,customerId,now)))
    }
}

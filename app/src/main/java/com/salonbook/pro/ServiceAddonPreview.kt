package com.salonbook.pro

internal object ServiceAddonPreview {
    data class Service(val id:String,val name:String,val pricePence:Long,val minutes:Int,
        val staffIds:Set<String>,val compatibleWith:Set<String>,val enabled:Boolean)
    data class Catalogue(val businessId:String,val revision:Long,val services:List<Service>)
    data class Draft(val businessId:String,val id:String,val customerId:String,val staffId:String,
        val start:Long,val serviceIds:List<String>,val revision:Long)
    data class Quote(val draftId:String,val draftRevision:Long,val catalogueRevision:Long,val scheduleRevision:Long,
        val addonId:String,val name:String,val extraPence:Long,val extraMinutes:Int,val totalPence:Long,val totalMinutes:Int)
    fun recommend(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        draft:Draft,currentDraft:Draft,catalogue:Catalogue,currentCatalogue:Catalogue,
        schedule:AppointmentGapPreview.Snapshot,currentSchedule:AppointmentGapPreview.Snapshot,
        preferences:CustomerPreferencesPreview.State?,now:Long):List<Quote>? {
        if(owner?.role!=EmployeeAccessPreview.Role.OWNER ||
            !EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            draft!=currentDraft || catalogue!=currentCatalogue || schedule!=currentSchedule ||
            draft.businessId!=business || catalogue.businessId!=business || schedule.businessId!=business ||
            draft.revision !in 1 until Long.MAX_VALUE || catalogue.revision<=0 ||
            draft.id.isBlank() || draft.customerId.isBlank() || draft.staffId.isBlank() ||
            draft.serviceIds.size !in 1..10 || draft.serviceIds.distinct().size!=draft.serviceIds.size ||
            catalogue.services.size>500 || catalogue.services.map{it.id}.distinct().size!=catalogue.services.size ||
            catalogue.services.any{it.id.isBlank() || it.name.isBlank() || it.pricePence !in 0..10000000L || it.minutes !in 5..720} ||
            preferences!=null && (preferences.businessId!=business || preferences.customerId!=draft.customerId || preferences.revision<0)) return null
        val selected=draft.serviceIds.map{id->catalogue.services.singleOrNull{it.id==id && it.enabled && draft.staffId in it.staffIds} ?: return null}
        val price=selected.sumOf{it.pricePence}
        val duration=selected.sumOf{it.minutes}
        if(duration>720 || draft.start<=now || draft.start>Long.MAX_VALUE-720*60000L) return null
        val favorites=preferences?.favoriteServiceIds.orEmpty()
        return catalogue.services.filter{it.enabled && it.id !in draft.serviceIds && draft.staffId in it.staffIds &&
            draft.serviceIds.all{id->id in it.compatibleWith} && duration+it.minutes<=720 && draft.serviceIds.size<10}
            .sortedWith(compareByDescending<Service>{it.id in favorites}.thenBy{it.id})
            .mapNotNull{service->
                val total=duration+service.minutes
                val end=draft.start+total*60000L
                val slots=AppointmentGapPreview.rank(owner,actor,business,schedule,currentSchedule,draft.staffId,draft.customerId,
                    total,draft.start,end,now) ?: return null
                if(slots.none{it.start==draft.start && it.end==end}) null
                else Quote(draft.id,draft.revision,catalogue.revision,schedule.revision,service.id,service.name,
                    service.pricePence,service.minutes,price+service.pricePence,total)
            }.take(10)
    }
    fun approve(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        draft:Draft,currentDraft:Draft,catalogue:Catalogue,currentCatalogue:Catalogue,
        schedule:AppointmentGapPreview.Snapshot,currentSchedule:AppointmentGapPreview.Snapshot,
        preferences:CustomerPreferencesPreview.State?,quote:Quote,verifiedCustomer:String,confirmed:Boolean,now:Long):Draft? {
        if(!confirmed || verifiedCustomer!=draft.customerId) return null
        val fresh=recommend(owner,actor,business,draft,currentDraft,catalogue,currentCatalogue,schedule,currentSchedule,preferences,now) ?: return null
        if(quote !in fresh) return null
        return draft.copy(revision=draft.revision+1,serviceIds=draft.serviceIds+quote.addonId)
    }
}

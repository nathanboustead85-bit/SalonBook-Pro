package com.salonbook.pro

internal object PremiumIntegrationPreview {
    enum class Kind { RECURRENCE, RECOVERY, ADDON, GAP }
    data class Claim(val id:String,val kind:Kind,val staffId:String,val customerId:String,val start:Long,val end:Long)
    data class Contact(val id:String,val customerId:String,val at:Long)
    data class State(val businessId:String,val revision:Long,val schedule:AppointmentGapPreview.Snapshot,
        val claims:List<Claim>,val contacts:List<Contact>)
    private fun allowed(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,s:State,current:State,now:Long):Boolean =
        owner?.role==EmployeeAccessPreview.Role.OWNER &&
        EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) &&
        s==current && s.businessId==business && s.schedule.businessId==business &&
        s.revision in 1 until Long.MAX_VALUE && now>0 && s.claims.size<=10000 && s.contacts.size<=10000 &&
        s.claims.map{it.id}.distinct().size==s.claims.size && s.contacts.map{it.id}.distinct().size==s.contacts.size &&
        s.claims.all{it.id.isNotBlank() && it.staffId.isNotBlank() && it.customerId.isNotBlank() && it.start>0 && it.end>it.start} &&
        s.contacts.all{it.id.isNotBlank() && it.customerId.isNotBlank() && it.at in 1..now}
    fun reserve(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,s:State,current:State,
        proposed:List<Claim>,now:Long):State? {
        if(!allowed(owner,actor,business,s,current,now) || proposed.size !in 1..52 ||
            s.claims.size+proposed.size>10000) return null
        val accepted=s.claims.toMutableList()
        for(c in proposed) {
            if(c.id.isBlank() || c.staffId.isBlank() || c.customerId.isBlank() || c.start<=now ||
                c.end<=c.start || (c.end-c.start)%60000L!=0L || (c.end-c.start)/60000L !in 5L..720L ||
                accepted.any{it.id==c.id || ((it.staffId==c.staffId || it.customerId==c.customerId) &&
                    it.start<c.end && c.start<it.end)}) return null
            val slots=AppointmentGapPreview.rank(owner,actor,business,s.schedule,current.schedule,c.staffId,c.customerId,
                ((c.end-c.start)/60000L).toInt(),c.start,c.end,now) ?: return null
            if(slots.none{it.start==c.start && it.end==c.end}) return null
            accepted.add(c)
        }
        return s.copy(revision=s.revision+1,claims=accepted.toList())
    }
    // Shared recommendation cooldown, not permission to send. Individual consent gates still apply.
    fun contact(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,s:State,current:State,
        id:String,customerId:String,now:Long):State? {
        if(!allowed(owner,actor,business,s,current,now) || id.isBlank() || customerId.isBlank() ||
            s.contacts.size>=10000 || s.contacts.any{it.id==id || (it.customerId==customerId && now-it.at<86400000L)}) return null
        return s.copy(revision=s.revision+1,contacts=s.contacts+Contact(id,customerId,now))
    }
}

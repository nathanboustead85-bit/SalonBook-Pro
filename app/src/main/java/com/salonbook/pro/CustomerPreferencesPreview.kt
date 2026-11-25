package com.salonbook.pro

/** Offline owner-only projection. Production requires authoritative identity and atomic persistence. */
internal object CustomerPreferencesPreview {
    data class State(val businessId:String,val customerId:String,val revision:Long,
        val preferredStaffId:String?=null,val favoriteServiceIds:List<String> = emptyList(),val styling:String="",val privateNotes:String="")
    private fun authorized(profile:CustomerProfilePreview.Record?,state:State?,owner:String?,requested:String?,customerId:String?):Boolean {
        val p=CustomerProfilePreview.read(profile,owner,requested,customerId) ?: return false
        return state!=null && state.businessId==p.businessId && state.customerId==p.customerId && state.revision>=0
    }
    fun read(profile:CustomerProfilePreview.Record?,state:State?,owner:String?,requested:String?,customerId:String?):State? {
        if(!authorized(profile,state,owner,requested,customerId) || state==null) return null
        return state.copy(favoriteServiceIds=state.favoriteServiceIds.toList())
    }
    fun edit(profile:CustomerProfilePreview.Record?,candidate:State?,current:State?,owner:String?,requested:String?,customerId:String?,
        staffId:String?,services:List<String>,styling:String,notes:String):State? {
        if(candidate!=current || !authorized(profile,current,owner,requested,customerId) || current==null || current.revision==Long.MAX_VALUE) return null
        fun safe(s:String,max:Int)=s.length<=max && s.none { (Character.isISOControl(it) && it!='\n') || Character.getType(it)==Character.FORMAT.toInt() }
        fun id(s:String)=s.isNotBlank() && s.length<=128 && s.none { it.isWhitespace() || Character.isISOControl(it) || Character.getType(it)==Character.FORMAT.toInt() }
        if(staffId!=null && !id(staffId) || services.size>50 || services.any { !id(it) } ||
            services.toSet().size!=services.size || !safe(styling,500) || !safe(notes,2000)) return null
        val proposed=current.copy(preferredStaffId=staffId,favoriteServiceIds=services.toList(),styling=styling.trim(),privateNotes=notes.trim())
        return if(proposed==current) proposed else proposed.copy(revision=current.revision+1)
    }
}

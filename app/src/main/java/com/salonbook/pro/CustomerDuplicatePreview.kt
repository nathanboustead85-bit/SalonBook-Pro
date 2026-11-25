package com.salonbook.pro
import java.util.Locale

/** No persistence, deletion or appointment reassignment. Production requires atomic migration and audit. */
internal object CustomerDuplicatePreview {
    enum class Match { NAME, EMAIL, PHONE }
    data class Plan(val keep:CustomerProfilePreview.Record,val source:CustomerProfilePreview.Record,
        val matches:Set<Match>,val conflictingContact:Boolean)
    fun preview(keep:CustomerProfilePreview.Record?,source:CustomerProfilePreview.Record?,owner:String?,requested:String?):Plan? {
        if(keep==null || source==null || keep.customerId==source.customerId ||
            CustomerProfilePreview.read(keep,owner,requested,keep.customerId)==null ||
            CustomerProfilePreview.read(source,owner,requested,source.customerId)==null) return null
        fun norm(s:String?)=s?.trim()?.lowercase(Locale.ROOT)?.takeIf { it.isNotEmpty() }
        fun phone(s:String?)=s?.filter { it in '0'..'9' }?.takeIf { it.length in 7..15 }
        val a=norm(keep.email); val b=norm(source.email)
        val c=phone(keep.phone); val d=phone(source.phone)
        val matches=mutableSetOf<Match>()
        if(norm(keep.name)==norm(source.name)) matches.add(Match.NAME)
        if(a!=null && a==b) matches.add(Match.EMAIL)
        if(c!=null && c==d) matches.add(Match.PHONE)
        if(matches.isEmpty()) return null
        return Plan(keep.copy(),source.copy(),matches.toSet(),(a!=null && b!=null && a!=b)||(c!=null && d!=null && c!=d))
    }
    /** Approval only validates a fresh proposal; never authorizes a live merge. */
    fun approvePreview(plan:Plan?,keep:CustomerProfilePreview.Record?,source:CustomerProfilePreview.Record?,
        owner:String?,requested:String?,explicitlyConfirmed:Boolean):Boolean {
        if(!explicitlyConfirmed || plan==null || plan.conflictingContact ||
            plan.matches.none { it==Match.EMAIL || it==Match.PHONE }) return false
        return plan==preview(keep,source,owner,requested)
    }
}

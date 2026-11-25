package com.salonbook.pro

/** Offline planning only: no export transmission, deletion, or legal retention determination. */
internal object CustomerPrivacyPreview {
    enum class Kind { ACCESS, ERASURE }
    enum class Decision { REVIEW_EXPORT, REVIEW_ERASURE, REVIEW_RETENTION }
    data class Request(val businessId:String,val customerId:String,val revision:Long,val kind:Kind,val verified:Boolean)
    data class Plan(val request:Request,val decision:Decision)
    fun plan(profile:CustomerProfilePreview.Record?,request:Request?,owner:String?,requested:String?,
        retentionReviewRequired:Boolean):Plan? {
        if(request==null || !request.verified) return null
        val p=CustomerProfilePreview.read(profile,owner,requested,request.customerId) ?: return null
        if(request.businessId!=p.businessId || request.revision!=p.revision) return null
        val decision=when(request.kind) {
            Kind.ACCESS -> Decision.REVIEW_EXPORT
            Kind.ERASURE -> if(retentionReviewRequired) Decision.REVIEW_RETENTION else Decision.REVIEW_ERASURE
        }
        return Plan(request.copy(),decision)
    }
    fun exportPreview(profile:CustomerProfilePreview.Record?,request:Request?,owner:String?,requested:String?,
        explicitlyConfirmed:Boolean):CustomerProfilePreview.Record? {
        if(!explicitlyConfirmed || plan(profile,request,owner,requested,true)?.decision!=Decision.REVIEW_EXPORT) return null
        return CustomerProfilePreview.read(profile,owner,requested,request?.customerId)
    }
}

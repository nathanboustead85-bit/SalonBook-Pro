package com.salonbook.pro

/** Offline authorization model. All current snapshots and time must come from trusted backend in production. */
internal object EmployeeSessionPreview {
    data class Session(val id:String,val businessId:String,val userId:String,val deviceId:String,
        val membershipRevision:Long,val policyRevision:Long,val issuedAt:Long,val expiresAt:Long,val revoked:Boolean=false)
    fun allows(candidate:Session?,current:Session?,member:EmployeeLifecyclePreview.State?,
        policy:EmployeePermissionPreview.Policy?,actor:String?,business:String?,device:String?,
        now:Long,grant:EmployeePermissionPreview.Grant):Boolean {
        if(current==null || candidate!=current || member==null || policy==null ||
            current.revoked || current.id.isBlank() || device.isNullOrBlank() || current.deviceId!=device ||
            actor.isNullOrBlank() || business.isNullOrBlank() || current.userId!=actor || current.businessId!=business ||
            current.issuedAt<=0 || current.expiresAt<=current.issuedAt ||
            current.expiresAt-current.issuedAt>86400000L || now<current.issuedAt || now>=current.expiresAt ||
            current.membershipRevision!=member.membership.revision || current.policyRevision!=policy.revision ||
            policy.businessId!=business || policy.userId!=actor || policy.membershipRevision!=current.membershipRevision ||
            policy.revision<0 || member.membership.role==EmployeeAccessPreview.Role.OWNER) return false
        return EmployeeLifecyclePreview.allows(member,member,actor,business,policy,grant)
    }
}

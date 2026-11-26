package com.salonbook.pro

/** Offline state transitions only. Production requires atomic persistence, verified identity and server time. */
internal object EmployeeInvitationPreview {
    enum class Status { PENDING, ACCEPTED, CANCELED }
    data class Invitation(val businessId:String,val id:String,val recipientId:String,
        val role:EmployeeAccessPreview.Role,val issuedAt:Long,val expiresAt:Long,val revision:Long=1,val status:Status=Status.PENDING)
    fun issue(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,id:String,recipientId:String,
        role:EmployeeAccessPreview.Role,now:Long,expiresAt:Long):Invitation? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.MANAGE_STAFF) ||
            business==null || id.isBlank() || recipientId.isBlank() || recipientId==actor ||
            role==EmployeeAccessPreview.Role.OWNER || now<=0 || expiresAt<=now || expiresAt-now>604800000L) return null
        return Invitation(business,id,recipientId,role,now,expiresAt)
    }
    private fun pending(candidate:Invitation?,current:Invitation?,business:String?,now:Long):Boolean =
        current!=null && candidate==current && !business.isNullOrBlank() && current.businessId==business &&
        current.id.isNotBlank() && current.recipientId.isNotBlank() && current.role!=EmployeeAccessPreview.Role.OWNER &&
        current.revision in 1 until Long.MAX_VALUE && current.status==Status.PENDING &&
        current.issuedAt>0 && current.expiresAt>current.issuedAt &&
        current.expiresAt-current.issuedAt<=604800000L && now>=current.issuedAt
    fun accept(candidate:Invitation?,current:Invitation?,business:String?,verifiedRecipient:String?,now:Long):Invitation? {
        if(!pending(candidate,current,business,now) || current==null || verifiedRecipient!=current.recipientId ||
            now>=current.expiresAt) return null
        return current.copy(status=Status.ACCEPTED,revision=current.revision+1)
    }
    fun cancel(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        candidate:Invitation?,current:Invitation?,now:Long):Invitation? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.MANAGE_STAFF) ||
            !pending(candidate,current,business,now) || current==null) return null
        return current.copy(status=Status.CANCELED,revision=current.revision+1)
    }
}

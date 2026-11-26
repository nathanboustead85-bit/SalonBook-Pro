package com.salonbook.pro

/** Offline policy only. Authoritative membership, atomic writes and resource checks are required on server. */
internal object EmployeePermissionPreview {
    enum class Grant { OWN_APPOINTMENTS, ALL_APPOINTMENTS, CREATE_BOOKINGS, EDIT_BOOKINGS, CANCEL_BOOKINGS,
        CUSTOMER_CONTACT, OWN_WORKING_HOURS, MESSAGING, OWN_PORTFOLIO, FINANCES, BILLING, BUSINESS_SETTINGS, MANAGE_STAFF }
    private val restricted=setOf(Grant.FINANCES,Grant.BILLING,Grant.BUSINESS_SETTINGS,Grant.MANAGE_STAFF)
    data class Policy(val businessId:String,val userId:String,val membershipRevision:Long,val revision:Long,val grants:Set<Grant>)
    private fun valid(m:EmployeeAccessPreview.Membership?,p:Policy?):Boolean =
        m!=null && p!=null && m.active && m.businessId.isNotBlank() && m.userId.isNotBlank() &&
        m.businessId==p.businessId && m.userId==p.userId && m.revision>0 &&
        m.revision==p.membershipRevision && p.revision>=0 && p.grants.none { it in restricted }
    fun change(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        target:EmployeeAccessPreview.Membership?,candidate:Policy?,current:Policy?,grants:Set<Grant>):Policy? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.MANAGE_STAFF) ||
            target==null || target.role==EmployeeAccessPreview.Role.OWNER || target.businessId!=business ||
            target.userId==actor || candidate!=current || !valid(target,current) || current==null ||
            current.revision==Long.MAX_VALUE || grants.any { it in restricted }) return null
        return if(current.grants==grants) current.copy(grants=grants.toSet())
        else current.copy(revision=current.revision+1,grants=grants.toSet())
    }
    fun allows(member:EmployeeAccessPreview.Membership?,actor:String?,business:String?,policy:Policy?,grant:Grant):Boolean {
        if(member==null || actor.isNullOrBlank() || business.isNullOrBlank() || member.userId!=actor ||
            member.businessId!=business || !member.active || member.revision<=0) return false
        if(member.role==EmployeeAccessPreview.Role.OWNER) return true
        return grant !in restricted && valid(member,policy) && policy!!.grants.contains(grant)
    }
}

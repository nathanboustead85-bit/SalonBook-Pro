package com.salonbook.pro

/** Offline policy preview only. Server must derive identity and membership authoritatively. */
internal object EmployeeAccessPreview {
    enum class Role { OWNER, MANAGER, EMPLOYEE }
    enum class Permission { OWN_APPOINTMENTS, ALL_APPOINTMENTS, CUSTOMER_CONTACT, MANAGE_STAFF, BUSINESS_SETTINGS, FINANCES, BILLING }
    data class Membership(val businessId:String,val userId:String,val role:Role,val active:Boolean,val revision:Long)
    fun allows(member:Membership?,actor:String?,business:String?,permission:Permission):Boolean {
        if(member==null || actor.isNullOrBlank() || business.isNullOrBlank() ||
            member.userId!=actor || member.businessId!=business || !member.active || member.revision<=0) return false
        return when(member.role) {
            Role.OWNER -> true
            Role.MANAGER -> permission in setOf(Permission.OWN_APPOINTMENTS,Permission.ALL_APPOINTMENTS,Permission.CUSTOMER_CONTACT)
            Role.EMPLOYEE -> permission==Permission.OWN_APPOINTMENTS
        }
    }
}

package com.salonbook.pro

/** Offline proposals only; server must atomically persist membership and enforce fresh authorization. */
internal object EmployeeLifecyclePreview {
    enum class Status { ACTIVE, SUSPENDED, REVOKED }
    data class State(val membership:EmployeeAccessPreview.Membership,val status:Status)
    fun change(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        candidate:State?,current:State?,next:Status):State? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.MANAGE_STAFF) ||
            current==null || candidate!=current) return null
        val m=current.membership
        if(m.businessId!=business || m.userId.isBlank() || m.userId==actor ||
            m.role==EmployeeAccessPreview.Role.OWNER || m.revision<=0 || m.revision==Long.MAX_VALUE ||
            m.active!=(current.status==Status.ACTIVE) || current.status==Status.REVOKED) return null
        if(next==current.status) return current.copy()
        return State(m.copy(active=next==Status.ACTIVE,revision=m.revision+1),next)
    }
    fun allows(candidate:State?,current:State?,actor:String?,business:String?,
        policy:EmployeePermissionPreview.Policy?,grant:EmployeePermissionPreview.Grant):Boolean {
        if(current==null || candidate!=current || current.status!=Status.ACTIVE) return false
        return EmployeePermissionPreview.allows(current.membership,actor,business,policy,grant)
    }
}

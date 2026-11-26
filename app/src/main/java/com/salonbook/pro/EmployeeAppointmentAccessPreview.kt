package com.salonbook.pro

/** Offline authorization only; trusted server must supply resource and identity snapshots. */
internal object EmployeeAppointmentAccessPreview {
    enum class Action { VIEW, CREATE, EDIT, CANCEL, CONTACT }
    data class Resource(val businessId:String,val bookingId:String,val staffUserId:String,val revision:Long,val historical:Boolean)
    fun allows(session:EmployeeSessionPreview.Session?,currentSession:EmployeeSessionPreview.Session?,
        member:EmployeeLifecyclePreview.State?,policy:EmployeePermissionPreview.Policy?,
        actor:String?,business:String?,device:String?,now:Long,resource:Resource?,current:Resource?,action:Action):Boolean {
        if(resource==null || resource.businessId!=business || resource.bookingId.isBlank() ||
            resource.staffUserId.isBlank() || actor.isNullOrBlank() || business.isNullOrBlank()) return false
        if(action==Action.CREATE) {
            if(current!=null || resource.revision!=0L || resource.historical) return false
        } else if(resource!=current || resource.revision<=0) return false
        if(resource.historical && action in setOf(Action.EDIT,Action.CANCEL)) return false
        fun has(grant:EmployeePermissionPreview.Grant)=EmployeeSessionPreview.allows(
            session,currentSession,member,policy,actor,business,device,now,grant)
        val scoped=has(EmployeePermissionPreview.Grant.ALL_APPOINTMENTS) ||
            (resource.staffUserId==actor && has(EmployeePermissionPreview.Grant.OWN_APPOINTMENTS))
        if(!scoped) return false
        return when(action) {
            Action.VIEW -> true
            Action.CREATE -> has(EmployeePermissionPreview.Grant.CREATE_BOOKINGS)
            Action.EDIT -> has(EmployeePermissionPreview.Grant.EDIT_BOOKINGS)
            Action.CANCEL -> has(EmployeePermissionPreview.Grant.CANCEL_BOOKINGS)
            Action.CONTACT -> has(EmployeePermissionPreview.Grant.CUSTOMER_CONTACT)
        }
    }
}

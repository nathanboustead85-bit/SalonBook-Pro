package com.salonbook.pro

internal object WaitingListPreview {
    data class Request(val businessId:String,val id:String,val customerId:String,val serviceId:String,
        val staffId:String?,val preferredFrom:Long,val preferredUntil:Long,val durationMillis:Long,
        val createdAt:Long,val expiresAt:Long)
    data class Ledger(val businessId:String,val revision:Long,val requests:List<Request>)
    data class Slot(val businessId:String,val bookingId:String,val serviceId:String,val staffId:String,
        val start:Long,val end:Long)
    private fun allowed(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?) =
        owner?.role==EmployeeAccessPreview.Role.OWNER &&
        EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS)
    private fun valid(r:Request,now:Long)=r.id.isNotBlank() && r.customerId.isNotBlank() &&
        r.serviceId.isNotBlank() && (r.staffId==null || r.staffId.isNotBlank()) &&
        r.createdAt>0 && r.createdAt<=now && r.expiresAt>r.createdAt &&
        r.preferredFrom>=r.createdAt && r.preferredUntil>r.preferredFrom &&
        r.durationMillis in 60000L..86400000L && r.preferredUntil-r.preferredFrom>=r.durationMillis
    private fun validLedger(l:Ledger,business:String?,now:Long)=l.businessId==business &&
        l.revision>0 && l.requests.size<=10000 &&
        l.requests.all{it.businessId==business && valid(it,now)} &&
        l.requests.map{it.id}.toSet().size==l.requests.size
    fun add(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        ledger:Ledger?,current:Ledger?,request:Request,now:Long):Ledger? {
        if(!allowed(owner,actor,business) || ledger==null || ledger!=current ||
            !validLedger(ledger,business,now) || ledger.revision==Long.MAX_VALUE ||
            ledger.requests.size>=10000 || request.businessId!=business || !valid(request,now) ||
            request.createdAt!=now || request.expiresAt<=now ||
            ledger.requests.any{it.id==request.id || (it.expiresAt>now &&
                it.customerId==request.customerId && it.serviceId==request.serviceId &&
                (it.staffId==null || request.staffId==null || it.staffId==request.staffId) &&
                it.preferredFrom<request.preferredUntil && request.preferredFrom<it.preferredUntil)}) return null
        return ledger.copy(revision=ledger.revision+1,requests=ledger.requests+request)
    }
    fun match(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        ledger:Ledger?,current:Ledger?,slot:Slot,canceled:AppointmentCancellationPreview.Appointment?,
        appointments:List<AppointmentCancellationPreview.Appointment>,now:Long):List<String>? {
        if(!allowed(owner,actor,business) || ledger==null || ledger!=current ||
            !validLedger(ledger,business,now) || now<=0 || slot.businessId!=business ||
            slot.serviceId.isBlank() || slot.staffId.isBlank() || slot.start<=now || slot.end<=slot.start ||
            canceled==null || !canceled.snapshot.booking.canceled ||
            canceled.snapshot.booking.businessId!=business || canceled.snapshot.booking.bookingId!=slot.bookingId ||
            canceled.staffId!=slot.staffId || canceled.snapshot.appointmentAtMillis!=slot.start ||
            canceled.endMillis!=slot.end || appointments.size>10000 ||
            !AppointmentCancellationPreview.slotAvailable(appointments,slot.businessId,slot.staffId,slot.start,slot.end)) return null
        return ledger.requests.filter{it.expiresAt>now && it.serviceId==slot.serviceId &&
            (it.staffId==null || it.staffId==slot.staffId) &&
            maxOf(slot.start,it.preferredFrom)<minOf(slot.end,it.preferredUntil) &&
            minOf(slot.end,it.preferredUntil)-maxOf(slot.start,it.preferredFrom)>=it.durationMillis}
            .sortedWith(compareBy<Request>{it.createdAt}.thenBy{it.id})
            .distinctBy{it.customerId}.map{it.id}
    }
}

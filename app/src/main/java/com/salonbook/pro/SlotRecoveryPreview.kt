package com.salonbook.pro

internal object SlotRecoveryPreview {
    enum class Status { PENDING, EXPIRED, DECLINED, ACCEPTED }
    data class Offer(val requestId:String,val customerId:String,val issuedAt:Long,val deadline:Long,val status:Status)
    data class State(val slot:WaitingListPreview.Slot,val revision:Long,val offers:List<Offer>)
    private fun valid(s:State,now:Long)=s.revision>0 && s.revision<Long.MAX_VALUE &&
        s.offers.size<=10000 && s.offers.map{it.customerId}.toSet().size==s.offers.size &&
        s.offers.all{it.requestId.isNotBlank() && it.customerId.isNotBlank() && it.issuedAt>0 &&
            it.issuedAt<=now && it.deadline>it.issuedAt && it.deadline<=s.slot.start} &&
        s.offers.zipWithNext().all{(a,b)->a.issuedAt<=b.issuedAt && a.status in setOf(Status.EXPIRED,Status.DECLINED)} &&
        s.offers.count{it.status==Status.ACCEPTED || it.status==Status.PENDING}<=1
    fun protected(s:State,now:Long):Boolean = s.offers.any{it.status==Status.ACCEPTED ||
        (it.status==Status.PENDING && now<it.deadline)}
    fun advance(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        state:State,current:State,waiting:WaitingListPreview.Ledger,currentWaiting:WaitingListPreview.Ledger,
        canceled:AppointmentCancellationPreview.Appointment?,appointments:List<AppointmentCancellationPreview.Appointment>,
        now:Long,responseMinutes:Int):State? {
        if(state!=current || !valid(state,now) || responseMinutes !in 5..120 ||
            state.offers.size>=10000 || protected(state,now)) return null
        val matches=WaitingListPreview.match(owner,actor,business,waiting,currentWaiting,state.slot,canceled,appointments,now) ?: return null
        val previous=state.offers.map{if(it.status==Status.PENDING) it.copy(status=Status.EXPIRED) else it}
        val next=matches.mapNotNull{id->waiting.requests.singleOrNull{it.id==id}}
            .firstOrNull{r->previous.none{it.customerId==r.customerId}}
        val deadline=if(next==null) now else minOf(state.slot.start,next.expiresAt,
            if(now>Long.MAX_VALUE-responseMinutes*60000L) Long.MAX_VALUE else now+responseMinutes*60000L)
        val offers=if(next==null || deadline<=now) previous else previous+Offer(next.id,next.customerId,now,deadline,Status.PENDING)
        return if(offers==state.offers) state else state.copy(revision=state.revision+1,offers=offers)
    }
    fun respond(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        state:State,current:State,waiting:WaitingListPreview.Ledger,currentWaiting:WaitingListPreview.Ledger,
        canceled:AppointmentCancellationPreview.Appointment?,appointments:List<AppointmentCancellationPreview.Appointment>,
        verifiedCustomer:String,requestId:String,accept:Boolean,now:Long):State? {
        if(state!=current || !valid(state,now)) return null
        val offer=state.offers.lastOrNull() ?: return null
        if(offer.status!=Status.PENDING || now>=offer.deadline || offer.customerId!=verifiedCustomer ||
            offer.requestId!=requestId) return null
        val matches=WaitingListPreview.match(owner,actor,business,waiting,currentWaiting,state.slot,canceled,appointments,now) ?: return null
        if(requestId !in matches || waiting.requests.none{it.id==requestId && it.customerId==verifiedCustomer}) return null
        return state.copy(revision=state.revision+1,offers=state.offers.dropLast(1)+offer.copy(
            status=if(accept) Status.ACCEPTED else Status.DECLINED))
    }
}

package com.salonbook.pro

/** Offline projection; production must query authoritative owner-scoped records. */
internal object CustomerAppointmentHistoryPreview {
    enum class Status { BOOKED, COMPLETED, CANCELED }
    data class Entry(val businessId:String,val customerId:String,val bookingId:String,
        val startsAt:Long,val service:String,val staff:String,val pricePence:Long,val status:Status)
    data class History(val previous:List<Entry>,val upcoming:List<Entry>,val canceled:List<Entry>)
    fun read(profile:CustomerProfilePreview.Record?,owner:String?,requested:String?,customerId:String?,
        records:List<Entry>,now:Long):History? {
        val customer=CustomerProfilePreview.read(profile,owner,requested,customerId) ?: return null
        if(now<=0 || records.size>10000) return null
        val scoped=records.filter { it.businessId==customer.businessId && it.customerId==customer.customerId }
        if(scoped.any { it.bookingId.isBlank() || it.startsAt<=0 || it.service.isBlank() ||
            it.staff.isBlank() || it.pricePence<0 } || scoped.map { it.bookingId }.toSet().size!=scoped.size) return null
        val ordered=scoped.sortedWith(compareBy<Entry>{it.startsAt}.thenBy{it.bookingId})
        return History(
            ordered.filter { it.status!=Status.CANCELED && (it.startsAt<now || it.status==Status.COMPLETED) }.reversed(),
            ordered.filter { it.status==Status.BOOKED && it.startsAt>=now },
            ordered.filter { it.status==Status.CANCELED }.reversed())
    }
}

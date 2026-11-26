package com.salonbook.pro

/** Appointment values in GBP pence, not verified payment receipts or profit. */
internal object RevenueReportPreview {
    data class Report(val completedValuePence:Long,val upcomingValuePence:Long,
        val canceledValuePence:Long,val overdueBookedValuePence:Long,
        val completedCount:Int,val upcomingCount:Int,val canceledCount:Int,val overdueBookedCount:Int)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,from:Long,until:Long,now:Long):Report? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.FINANCES) ||
            from<=0 || until<=from || now<=0 || records.size>10000) return null
        val scoped=records.filter { it.businessId==business }
        if(scoped.any { it.bookingId.isBlank() || it.customerId.isBlank() || it.startsAt<=0 ||
            it.pricePence<0 || (it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED && it.startsAt>now) } ||
            scoped.map { it.bookingId }.toSet().size!=scoped.size) return null
        val values=LongArray(4)
        val counts=IntArray(4)
        for(e in scoped.filter { it.startsAt>=from && it.startsAt<until }) {
            val i=when(e.status) {
                CustomerAppointmentHistoryPreview.Status.COMPLETED -> 0
                CustomerAppointmentHistoryPreview.Status.CANCELED -> 2
                CustomerAppointmentHistoryPreview.Status.BOOKED -> if(e.startsAt>=now) 1 else 3
            }
            if(Long.MAX_VALUE-values[i]<e.pricePence) return null
            values[i]+=e.pricePence
            counts[i]++
        }
        return Report(values[0],values[1],values[2],values[3],counts[0],counts[1],counts[2],counts[3])
    }
}

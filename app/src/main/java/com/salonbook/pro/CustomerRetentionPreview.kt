package com.salonbook.pro

import java.math.BigDecimal
import java.math.RoundingMode

internal object CustomerRetentionPreview {
    data class Customer(val customerId:String,val visits:Int,val lifetimeValuePence:Long,val lastVisit:Long,val inactive:Boolean)
    data class Report(val newCustomers:Int,val returningCustomers:Int,val priorCustomers:Int,
        val retainedCustomers:Int,val retentionPercent:BigDecimal?,val averageVisits:BigDecimal?,
        val averageLifetimeValuePence:BigDecimal?,val customers:List<Customer>)
    private fun ratio(n:Long,d:Int,scale:Long=1):BigDecimal? =
        if(d==0) null else BigDecimal.valueOf(n).multiply(BigDecimal.valueOf(scale))
            .divide(BigDecimal.valueOf(d.toLong()),2,RoundingMode.HALF_UP)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,range:ReportingPeriodPreview.Range,
        now:Long,inactiveBefore:Long):Report? {
        if(range.from<=0 || range.until<=range.from || range.from>now || inactiveBefore<=0 || inactiveBefore>now) return null
        val total=RevenueReportPreview.calculate(owner,actor,business,records,1,Long.MAX_VALUE,now) ?: return null
        val completed=records.filter { it.businessId==business && it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED }
        val prior=completed.filter { it.startsAt<range.from }.map { it.customerId }.toSet()
        val current=completed.filter { it.startsAt>=range.from && it.startsAt<range.until }
        val active=current.map { it.customerId }.toSet()
        val retained=active.intersect(prior).size
        val customers=completed.groupBy { it.customerId }.map { (id,entries) ->
            val last=entries.maxOf { it.startsAt }
            Customer(id,entries.size,entries.sumOf { it.pricePence },last,last<inactiveBefore)
        }.sortedWith(compareByDescending<Customer>{it.visits}.thenByDescending{it.lifetimeValuePence}.thenBy{it.customerId})
        return Report(active.size-retained,retained,prior.size,retained,ratio(retained.toLong(),prior.size,100),
            ratio(current.size.toLong(),active.size),ratio(total.completedValuePence,customers.size),customers)
    }
}

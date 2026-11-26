package com.salonbook.pro
import java.math.BigDecimal
import java.math.RoundingMode

internal object MarketingAnalyticsPreview {
    enum class Kind { PROMOTION, LOYALTY, BIRTHDAY, REENGAGEMENT, REFERRAL }
    data class Event(val businessId:String,val id:String,val customerId:String,val kind:Kind,
        val issuedAt:Long,val redeemedAt:Long?,val bookingId:String?,val discountPence:Long,
        val attributedMarginPence:Long,val campaignCostPence:Long)
    data class Row(val kind:Kind,val issued:Int,val redeemed:Int,val uniqueRecipients:Int,
        val uniqueRedeemers:Int,val discountPence:Long,val attributedMarginPence:Long,
        val campaignCostPence:Long,val redemptionPercent:BigDecimal?,val customerUptakePercent:BigDecimal?,
        val roiPercent:BigDecimal?)
    private fun ratio(n:BigDecimal,d:BigDecimal):BigDecimal? =
        if(d.signum()==0) null else n.multiply(BigDecimal(100)).divide(d,2,RoundingMode.HALF_UP)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        events:List<Event>,from:Long,until:Long,now:Long):List<Row>? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.FINANCES) ||
            owner?.role!=EmployeeAccessPreview.Role.OWNER || from<=0 || until<=from || now<=0 ||
            events.size>10000) return null
        val scoped=events.filter{it.businessId==business}
        if(scoped.any{it.id.isBlank() || it.customerId.isBlank() || it.issuedAt<=0 || it.issuedAt>now ||
            it.discountPence<0 || it.attributedMarginPence<0 || it.campaignCostPence<0 ||
            (it.redeemedAt==null && (it.bookingId!=null || it.discountPence!=0L || it.attributedMarginPence!=0L)) ||
            (it.redeemedAt!=null && (it.redeemedAt<it.issuedAt || it.redeemedAt>now || it.bookingId.isNullOrBlank()))} ||
            scoped.map{it.id}.toSet().size!=scoped.size ||
            scoped.mapNotNull{it.bookingId}.let{it.toSet().size!=it.size}) return null
        return try {
            Kind.values().map { kind ->
                val cohort=scoped.filter{it.kind==kind && it.issuedAt>=from && it.issuedAt<until}
                val redeemed=cohort.filter{it.redeemedAt!=null && it.redeemedAt<until}
                val recipients=cohort.map{it.customerId}.toSet().size
                val redeemers=redeemed.map{it.customerId}.toSet().size
                val discount=redeemed.fold(0L){a,e->Math.addExact(a,e.discountPence)}
                val margin=redeemed.fold(0L){a,e->Math.addExact(a,e.attributedMarginPence)}
                val cost=cohort.fold(0L){a,e->Math.addExact(a,e.campaignCostPence)}
                val spend=BigDecimal.valueOf(discount).add(BigDecimal.valueOf(cost))
                Row(kind,cohort.size,redeemed.size,recipients,redeemers,discount,margin,cost,
                    ratio(BigDecimal(redeemed.size),BigDecimal(cohort.size)),
                    ratio(BigDecimal(redeemers),BigDecimal(recipients)),
                    ratio(BigDecimal.valueOf(margin).subtract(spend),spend))
            }
        } catch(e:ArithmeticException) { null }
    }
}

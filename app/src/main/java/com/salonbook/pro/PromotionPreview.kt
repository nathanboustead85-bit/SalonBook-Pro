package com.salonbook.pro

internal object PromotionPreview {
    enum class Kind { PERCENT, FIXED }
    data class Offer(val businessId:String,val code:String,val revision:Long,val enabled:Boolean,
        val kind:Kind,val value:Long,val startsAt:Long,val expiresAt:Long,val maxUses:Int,
        val firstVisitOnly:Boolean=false,val quietFromHour:Int?=null,val quietUntilHour:Int?=null)
    data class Use(val bookingId:String,val customerId:String)
    data class Ledger(val businessId:String,val code:String,val revision:Long,val uses:List<Use>)
    data class Result(val discountPence:Long,val ledger:Ledger)
    fun apply(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        offer:Offer?,currentOffer:Offer?,ledger:Ledger?,currentLedger:Ledger?,
        code:String,bookingId:String,customerId:String,pricePence:Long,appointmentAt:Long,now:Long,
        history:List<CustomerAppointmentHistoryPreview.Entry>,confirmed:Boolean):Result? {
        if(!confirmed || !EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            owner?.role!=EmployeeAccessPreview.Role.OWNER || offer==null || offer!=currentOffer ||
            ledger==null || ledger!=currentLedger || offer.businessId!=business || ledger.businessId!=business ||
            !offer.enabled || offer.revision<=0 || ledger.revision<=0 || ledger.revision==Long.MAX_VALUE ||
            !code.matches(Regex("[A-Z0-9_-]{1,32}")) || code!=offer.code || code!=ledger.code ||
            bookingId.isBlank() || customerId.isBlank() || pricePence<=0 || now<=0 || now==Long.MAX_VALUE ||
            offer.startsAt<=0 || offer.expiresAt<=offer.startsAt || now<offer.startsAt || now>=offer.expiresAt ||
            appointmentAt<now || appointmentAt>=offer.expiresAt || offer.maxUses !in 1..10000 ||
            ledger.uses.size>=offer.maxUses || ledger.uses.any{it.bookingId.isBlank() || it.customerId.isBlank()} ||
            ledger.uses.map{it.bookingId}.toSet().size!=ledger.uses.size ||
            ledger.uses.map{it.customerId}.toSet().size!=ledger.uses.size ||
            ledger.uses.any{it.bookingId==bookingId || it.customerId==customerId}) return null
        RevenueReportPreview.calculate(owner,actor,business,history,1,now+1,now) ?: return null
        if(offer.firstVisitOnly && history.any{it.businessId==business && it.customerId==customerId &&
            it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED}) return null
        val from=offer.quietFromHour
        val until=offer.quietUntilHour
        if(from!=null || until!=null) {
            if(from==null || until==null || from !in 0..23 || until !in 1..24 || from>=until) return null
            val hour=try { java.time.Instant.ofEpochMilli(appointmentAt).atZone(java.time.ZoneId.of("Europe/London")).hour }
                catch(e:RuntimeException) { return null }
            if(hour !in from until until) return null
        }
        val discount=when(offer.kind) {
            Kind.PERCENT -> {
                if(offer.value !in 1L..100L) return null
                java.math.BigInteger.valueOf(pricePence).multiply(java.math.BigInteger.valueOf(offer.value))
                    .divide(java.math.BigInteger.valueOf(100)).toLong()
            }
            Kind.FIXED -> if(offer.value<=0) return null else minOf(pricePence,offer.value)
        }
        if(discount<=0) return null
        return Result(discount,ledger.copy(revision=ledger.revision+1,uses=ledger.uses+Use(bookingId,customerId)))
    }
}

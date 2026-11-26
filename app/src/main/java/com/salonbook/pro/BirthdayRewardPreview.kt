package com.salonbook.pro

import java.time.*

internal object BirthdayRewardPreview {
    enum class Kind { PERCENT, FIXED, FREE_SERVICE }
    data class Birthday(val businessId:String,val customerId:String,val month:Int,val day:Int)
    data class Offer(val businessId:String,val revision:Long,val enabled:Boolean,val kind:Kind,
        val value:Long,val serviceId:String?,val validDays:Int)
    data class Claim(val customerId:String,val year:Int)
    data class Ledger(val businessId:String,val revision:Long,val claims:Set<Claim>)
    data class Result(val discountPence:Long,val expiresOn:LocalDate,val ledger:Ledger)
    fun issue(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        birthday:Birthday?,customerId:String,offer:Offer?,currentOffer:Offer?,
        ledger:Ledger?,currentLedger:Ledger?,now:Long,serviceId:String,pricePence:Long,
        channel:MarketingConsentPreview.Channel,recipient:String,
        consent:MarketingConsentPreview.Consent?,currentConsent:MarketingConsentPreview.Consent?,
        marketingEnabled:Boolean,suppressed:Boolean):Result? {
        if(birthday==null || birthday.businessId!=business || birthday.customerId!=customerId ||
            offer==null || offer!=currentOffer || offer.businessId!=business || !offer.enabled ||
            offer.revision<=0 || offer.validDays !in 1..90 || ledger==null || ledger!=currentLedger ||
            ledger.businessId!=business || ledger.revision<=0 || ledger.revision==Long.MAX_VALUE ||
            ledger.claims.size>=10000 || now<=0 || pricePence<=0 || serviceId.isBlank() ||
            (offer.serviceId!=null && offer.serviceId!=serviceId) ||
            !MarketingConsentPreview.eligible(owner,actor,business,customerId,channel,recipient,
                consent,currentConsent,now,marketingEnabled,suppressed)) return null
        val today:LocalDate
        val md:MonthDay
        try {
            today=Instant.ofEpochMilli(now).atZone(ZoneId.of("Europe/London")).toLocalDate()
            md=MonthDay.of(birthday.month,birthday.day)
        } catch(e:RuntimeException) { return null }
        // MonthDay.atYear maps 29 February to 28 February in non-leap years.
        val start=listOf(today.year,today.year-1).map{md.atYear(it)}
            .firstOrNull{!today.isBefore(it) && today.isBefore(it.plusDays(offer.validDays.toLong()))} ?: return null
        val claim=Claim(customerId,start.year)
        if(claim in ledger.claims) return null
        val discount=when(offer.kind) {
            Kind.PERCENT -> if(offer.value !in 1L..100L) return null else
                java.math.BigInteger.valueOf(pricePence).multiply(java.math.BigInteger.valueOf(offer.value))
                    .divide(java.math.BigInteger.valueOf(100)).toLong()
            Kind.FIXED -> if(offer.value<=0) return null else minOf(pricePence,offer.value)
            Kind.FREE_SERVICE -> if(offer.serviceId.isNullOrBlank() || offer.value!=0L) return null else pricePence
        }
        if(discount<=0) return null
        return Result(discount,start.plusDays(offer.validDays.toLong()),
            ledger.copy(revision=ledger.revision+1,claims=ledger.claims+claim))
    }
}

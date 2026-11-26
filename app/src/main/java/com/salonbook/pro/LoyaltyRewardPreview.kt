package com.salonbook.pro

internal object LoyaltyRewardPreview {
    enum class Kind { FREE_SERVICE, PERCENT, FIXED }
    data class Reward(val businessId:String,val id:String,val revision:Long,val enabled:Boolean,
        val cost:Long,val kind:Kind,val value:Long,val serviceId:String?,val startsAt:Long,val expiresAt:Long)
    data class Account(val businessId:String,val customerId:String,val revision:Long,val units:Long,
        val redeemedIds:Set<String> = emptySet())
    data class Result(val account:Account,val discountPence:Long)
    fun redeem(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        reward:Reward?,currentReward:Reward?,account:Account?,currentAccount:Account?,
        customerId:String,redemptionId:String,serviceId:String,pricePence:Long,now:Long,confirmed:Boolean):Result? {
        if(!confirmed || !EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            owner?.role!=EmployeeAccessPreview.Role.OWNER || reward==null || reward!=currentReward ||
            account==null || account!=currentAccount || reward.businessId!=business || account.businessId!=business ||
            account.customerId!=customerId || customerId.isBlank() || reward.id.isBlank() ||
            reward.revision<=0 || account.revision<=0 || account.revision==Long.MAX_VALUE ||
            !reward.enabled || reward.startsAt<=0 || reward.expiresAt<=reward.startsAt ||
            now<reward.startsAt || now>=reward.expiresAt || reward.cost<=0 || account.units<reward.cost ||
            redemptionId.isBlank() || redemptionId.length>128 || account.redeemedIds.size>=10000 ||
            redemptionId in account.redeemedIds || serviceId.isBlank() || pricePence<=0 ||
            (reward.serviceId!=null && reward.serviceId!=serviceId)) return null
        val discount=when(reward.kind) {
            Kind.FREE_SERVICE -> if(reward.serviceId.isNullOrBlank() || reward.value!=0L) return null else pricePence
            Kind.PERCENT -> {
                if(reward.value !in 1L..100L) return null
                java.math.BigInteger.valueOf(pricePence).multiply(java.math.BigInteger.valueOf(reward.value))
                    .divide(java.math.BigInteger.valueOf(100)).toLong()
            }
            Kind.FIXED -> if(reward.value<=0) return null else minOf(reward.value,pricePence)
        }
        if(discount<=0) return null
        return Result(account.copy(revision=account.revision+1,units=account.units-reward.cost,
            redeemedIds=account.redeemedIds+redemptionId),discount)
    }
}

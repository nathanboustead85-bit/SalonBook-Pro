package com.salonbook.pro

internal object ReferralPreview {
    data class Programme(val businessId:String,val revision:Long,val enabled:Boolean,val referrerPence:Long,val newcomerPence:Long)
    data class Code(val businessId:String,val code:String,val referrerId:String,val issuedAt:Long,val expiresAt:Long)
    data class Claim(val newcomerId:String,val bookingId:String,val referrerId:String)
    data class Ledger(val businessId:String,val revision:Long,val claims:List<Claim>)
    data class Result(val referrerPence:Long,val newcomerPence:Long,val ledger:Ledger)
    fun qualify(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        programme:Programme?,currentProgramme:Programme?,codes:List<Code>,code:String,
        newcomerId:String,bookingId:String,ledger:Ledger?,currentLedger:Ledger?,
        records:List<CustomerAppointmentHistoryPreview.Entry>,now:Long):Result? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            owner?.role!=EmployeeAccessPreview.Role.OWNER || programme==null || programme!=currentProgramme ||
            programme.businessId!=business || !programme.enabled || programme.revision<=0 ||
            programme.referrerPence !in 0L..100000L || programme.newcomerPence !in 0L..100000L ||
            (programme.referrerPence==0L && programme.newcomerPence==0L) ||
            ledger==null || ledger!=currentLedger || ledger.businessId!=business || ledger.revision<=0 ||
            ledger.revision==Long.MAX_VALUE || ledger.claims.size>=10000 || codes.size>10000 ||
            newcomerId.isBlank() || bookingId.isBlank() || now<=0 || now==Long.MAX_VALUE ||
            ledger.claims.any{it.newcomerId.isBlank() || it.bookingId.isBlank() || it.referrerId.isBlank() || it.newcomerId==it.referrerId} ||
            ledger.claims.map{it.newcomerId}.toSet().size!=ledger.claims.size ||
            ledger.claims.map{it.bookingId}.toSet().size!=ledger.claims.size ||
            ledger.claims.any{it.newcomerId==newcomerId || it.bookingId==bookingId}) return null
        val scoped=codes.filter{it.businessId==business}
        if(scoped.any{!it.code.matches(Regex("[A-Z0-9]{12,32}")) || it.referrerId.isBlank() ||
            it.issuedAt<=0 || it.expiresAt<=it.issuedAt} ||
            scoped.map{it.code}.toSet().size!=scoped.size) return null
        val referral=scoped.singleOrNull{it.code==code} ?: return null
        if(referral.referrerId==newcomerId || now<referral.issuedAt || now>=referral.expiresAt) return null
        RevenueReportPreview.calculate(owner,actor,business,records,1,now+1,now) ?: return null
        val completed=records.filter{it.businessId==business && it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED}
        val first=completed.filter{it.customerId==newcomerId}
            .sortedWith(compareBy<CustomerAppointmentHistoryPreview.Entry>{it.startsAt}.thenBy{it.bookingId})
            .firstOrNull() ?: return null
        if(first.bookingId!=bookingId || first.startsAt<referral.issuedAt ||
            !completed.any{it.customerId==referral.referrerId && it.startsAt<referral.issuedAt}) return null
        return Result(programme.referrerPence,programme.newcomerPence,
            ledger.copy(revision=ledger.revision+1,claims=ledger.claims+Claim(newcomerId,bookingId,referral.referrerId)))
    }
}

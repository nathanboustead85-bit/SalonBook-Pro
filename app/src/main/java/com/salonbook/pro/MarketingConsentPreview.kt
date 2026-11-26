package com.salonbook.pro

internal object MarketingConsentPreview {
    enum class Channel { EMAIL, WHATSAPP }
    data class Consent(val businessId:String,val customerId:String,val channel:Channel,
        val recipient:String,val allowed:Boolean,val revision:Long,val changedAt:Long)
    fun eligible(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        customerId:String,channel:Channel,recipient:String,candidate:Consent?,current:Consent?,
        now:Long,businessEnabled:Boolean,suppressed:Boolean):Boolean {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            owner?.role!=EmployeeAccessPreview.Role.OWNER || !businessEnabled || suppressed ||
            candidate==null || candidate!=current || !candidate.allowed || candidate.revision<=0 ||
            candidate.changedAt<=0 || candidate.changedAt>now || customerId.isBlank() ||
            candidate.businessId!=business || candidate.customerId!=customerId ||
            candidate.channel!=channel || candidate.recipient!=recipient || recipient.length>254 ||
            recipient.any{it.isWhitespace() || Character.isISOControl(it) || Character.getType(it)==Character.FORMAT.toInt()}) return false
        return when(channel) {
            Channel.EMAIL -> recipient.matches(Regex("[^@]+@[^@]+\\.[^@]+"))
            Channel.WHATSAPP -> recipient.matches(Regex("\\+[1-9][0-9]{7,14}"))
        }
    }
}

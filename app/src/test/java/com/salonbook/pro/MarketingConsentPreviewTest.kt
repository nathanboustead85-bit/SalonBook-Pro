package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class MarketingConsentPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val consent=MarketingConsentPreview.Consent("b","c",MarketingConsentPreview.Channel.EMAIL,"c@example.com",true,1,100)
    private fun check(candidate:MarketingConsentPreview.Consent?=consent,current:MarketingConsentPreview.Consent?=consent,
        enabled:Boolean=true,suppressed:Boolean=false,member:EmployeeAccessPreview.Membership=owner)=
        MarketingConsentPreview.eligible(member,"o","b","c",MarketingConsentPreview.Channel.EMAIL,"c@example.com",candidate,current,200,enabled,suppressed)
    @Test fun explicitConsentOnly() {
        assertTrue(check())
        assertFalse(check(null,null))
        assertFalse(check(current=consent.copy(allowed=false,revision=2)))
        assertFalse(check(enabled=false))
        assertFalse(check(suppressed=true))
        assertFalse(check(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
        for(c in listOf(consent.copy(allowed=false),consent.copy(businessId="other"),consent.copy(customerId="other"),
            consent.copy(recipient="other@example.com"),consent.copy(changedAt=201),consent.copy(revision=0),
            consent.copy(channel=MarketingConsentPreview.Channel.WHATSAPP))) assertFalse(check(c,c))
    }
    @Test fun whatsappRequiresSeparateConsent() {
        val c=consent.copy(channel=MarketingConsentPreview.Channel.WHATSAPP,recipient="+447123456789")
        assertTrue(MarketingConsentPreview.eligible(owner,"o","b","c",c.channel,c.recipient,c,c,200,true,false))
        assertFalse(MarketingConsentPreview.eligible(owner,"o","b","c",c.channel,c.recipient,consent,consent,200,true,false))
    }
}

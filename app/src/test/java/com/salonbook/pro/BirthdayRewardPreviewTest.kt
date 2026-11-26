package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*
import java.time.*

class BirthdayRewardPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val birthday=BirthdayRewardPreview.Birthday("b","c",2,29)
    private val offer=BirthdayRewardPreview.Offer("b",1,true,BirthdayRewardPreview.Kind.PERCENT,20,null,7)
    private val ledger=BirthdayRewardPreview.Ledger("b",1,emptySet())
    private val channel=MarketingConsentPreview.Channel.EMAIL
    private fun issue(date:String="2027-02-28",birth:BirthdayRewardPreview.Birthday?=birthday,
        o:BirthdayRewardPreview.Offer=offer,l:BirthdayRewardPreview.Ledger=ledger,
        current:BirthdayRewardPreview.Ledger=l,allowed:Boolean=true,suppressed:Boolean=false,enabled:Boolean=true):BirthdayRewardPreview.Result? {
        val now=LocalDate.parse(date).atTime(12,0).atZone(ZoneId.of("Europe/London")).toInstant().toEpochMilli()
        val consent=MarketingConsentPreview.Consent("b","c",channel,"c@example.com",allowed,1,now-1)
        return BirthdayRewardPreview.issue(owner,"o","b",birth,"c",o,o,l,current,now,"cut",2500,
            channel,consent.recipient,consent,consent,enabled,suppressed)
    }
    @Test fun leapYearsAndAnnualProtection() {
        val result=issue()!!
        assertEquals(500L,result.discountPence)
        assertEquals(LocalDate.parse("2027-03-07"),result.expiresOn)
        assertNull(issue(l=result.ledger))
        assertNull(issue(current=result.ledger))
        assertNull(issue(date="2027-03-07"))
        assertNull(issue(date="2028-02-28"))
        assertNotNull(issue(date="2028-02-29",l=result.ledger))
        val dec=birthday.copy(month=12,day=30)
        assertTrue(issue(date="2027-01-02",birth=dec)!!.ledger.claims.contains(BirthdayRewardPreview.Claim("c",2026)))
    }
    @Test fun consentPrivacyAndValues() {
        assertNull(issue(birth=null))
        assertNull(issue(birth=birthday.copy(day=30)))
        assertNull(issue(birth=birthday.copy(businessId="other")))
        assertNull(issue(birth=birthday.copy(customerId="other")))
        assertNull(issue(allowed=false))
        assertNull(issue(suppressed=true))
        assertNull(issue(enabled=false))
        assertNull(issue(o=offer.copy(validDays=0)))
        assertEquals(2500L,issue(o=offer.copy(kind=BirthdayRewardPreview.Kind.FIXED,value=3000))!!.discountPence)
        assertEquals(2500L,issue(o=offer.copy(kind=BirthdayRewardPreview.Kind.FREE_SERVICE,value=0,serviceId="cut"))!!.discountPence)
        assertNull(issue(o=offer.copy(kind=BirthdayRewardPreview.Kind.FREE_SERVICE,value=0,serviceId="other")))
    }
}

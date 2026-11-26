package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class ReengagementPreviewTest {
    private val day=86400000L
    private val now=500*day
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val campaign=ReengagementPreview.Campaign("b","return",1,true,60,30,15,now-day,now+day)
    private val ledger=ReengagementPreview.Ledger("b",1,emptyList())
    private val channel=MarketingConsentPreview.Channel.EMAIL
    private val consent=MarketingConsentPreview.Consent("b","c",channel,"c@example.com",true,1,now-1)
    private val past=CustomerAppointmentHistoryPreview.Entry("b","c","past",now-60*day,"cut","staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED)
    private fun propose(c:ReengagementPreview.Campaign=campaign,l:ReengagementPreview.Ledger=ledger,
        current:ReengagementPreview.Ledger=l,rows:List<CustomerAppointmentHistoryPreview.Entry> = listOf(past),
        fresh:MarketingConsentPreview.Consent=consent,suppressed:Boolean=false,enabled:Boolean=true)=
        ReengagementPreview.propose(owner,"o","b",c,c,l,current,rows,"c",now,channel,consent.recipient,
            consent,fresh,enabled,suppressed)
    @Test fun eligibilityAndUpcoming() {
        val result=propose()!!
        assertEquals(15,result.discountPercent)
        assertEquals("c",result.customerId)
        assertEquals(2L,result.ledger.revision)
        assertTrue(ledger.events.isEmpty())
        assertNull(propose(c=campaign.copy(inactiveDays=90)))
        assertNull(propose(rows=listOf(past.copy(startsAt=now-59*day))))
        assertNull(propose(rows=emptyList()))
        val upcoming=past.copy(bookingId="next",startsAt=now+day,status=CustomerAppointmentHistoryPreview.Status.BOOKED)
        assertNull(propose(rows=listOf(past,upcoming)))
        assertNotNull(propose(rows=listOf(past,upcoming.copy(status=CustomerAppointmentHistoryPreview.Status.CANCELED))))
        assertNull(propose(rows=listOf(past,past)))
    }
    @Test fun consentAndFrequency() {
        val result=propose()!!
        assertNull(propose(l=result.ledger))
        assertNull(propose(current=result.ledger))
        assertNull(propose(c=campaign.copy(id="other"),l=result.ledger))
        val old=ledger.copy(events=listOf(ReengagementPreview.Event("other","c",now-30*day)))
        assertNotNull(propose(l=old))
        assertNull(propose(fresh=consent.copy(allowed=false,revision=2)))
        assertNull(propose(suppressed=true))
        assertNull(propose(enabled=false))
        assertNull(propose(c=campaign.copy(businessId="other")))
        assertNull(propose(c=campaign.copy(expiresAt=now)))
        assertNull(propose(rows=listOf(past.copy(businessId="other"))))
    }
}

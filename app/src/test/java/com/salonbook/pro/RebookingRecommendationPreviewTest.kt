package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.time.*

class RebookingRecommendationPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val now=Instant.parse("2026-11-26T10:00:00Z").toEpochMilli()
    private val day=86400000L
    private val channel=MarketingConsentPreview.Channel.EMAIL
    private val recipient="test@example.invalid"
    private val consent=MarketingConsentPreview.Consent("b","c",channel,recipient,true,1,now-day)
    private val ledger=RebookingRecommendationPreview.Ledger("b",1,emptyList())
    private val visits=(1..3).map{CustomerAppointmentHistoryPreview.Entry("b","c","v"+it,now-(4-it)*14*day,
        "cut",if(it==3)"other" else "staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED)}
    private fun propose(records:List<CustomerAppointmentHistoryPreview.Entry> = visits,
        l:RebookingRecommendationPreview.Ledger=ledger,current:RebookingRecommendationPreview.Ledger=l,
        c:MarketingConsentPreview.Consent?=consent,cc:MarketingConsentPreview.Consent?=c,
        member:EmployeeAccessPreview.Membership=owner,suppressed:Boolean=false)=
        RebookingRecommendationPreview.propose(member,"o","b",records,"c",l,current,now,7,14,channel,recipient,c,cc,true,suppressed)
    @Test fun frequencyAndPreference() {
        val p=propose()!!
        assertEquals(14L,p.intervalDays)
        assertEquals(LocalDate.of(2026,11,26),p.predictedDate)
        assertEquals("staff",p.staff)
        assertEquals("cut",p.service)
        assertTrue(ledger.events.isEmpty())
        assertNull(propose(l=p.ledger))
        assertNull(propose(current=p.ledger))
        assertNull(propose(records=visits.take(2)))
        assertNull(propose(records=visits+visits.first()))
        assertNull(propose(records=visits+visits.last().copy(bookingId="future",startsAt=now+day,status=CustomerAppointmentHistoryPreview.Status.BOOKED)))
        assertEquals(p,propose(records=visits+visits.last().copy(businessId="other",bookingId="foreign",startsAt=now+day,status=CustomerAppointmentHistoryPreview.Status.BOOKED)))
    }
    @Test fun privacyAndConsent() {
        assertNull(propose(c=null))
        assertNull(propose(cc=consent.copy(allowed=false,revision=2)))
        assertNull(propose(c=consent.copy(allowed=false)))
        assertNull(propose(suppressed=true))
        assertNull(propose(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
        assertNull(propose(member=owner.copy(businessId="other")))
        assertNull(propose(records=visits.map{it.copy(customerId="other")}))
    }
}

package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class CustomerSegmentationPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val now=200L*86400000L
    private fun entry(id:String,c:String,day:Int,price:Long=5000,business:String="b")=
        CustomerAppointmentHistoryPreview.Entry(business,c,id,day*86400000L,"cut","staff",price,CustomerAppointmentHistoryPreview.Status.COMPLETED)
    private val records=listOf(entry("a","new",199),entry("b","regular",199),entry("c","regular",198),
        entry("d","old",10),entry("foreign","foreign",199,business="other"))+
        (1..5).map{entry("l"+it,"loyal",190+it)}
    @Test fun classifications() {
        val rows=CustomerSegmentationPreview.classify(owner,"o","b",records,now)!!.associateBy{it.customerId}
        val s=CustomerSegmentationPreview.Segment.values()
        assertEquals(setOf(s[0]),rows["new"]!!.segments)
        assertEquals(setOf(s[1]),rows["regular"]!!.segments)
        assertEquals(setOf(s[2],s[3]),rows["loyal"]!!.segments)
        assertEquals(setOf(s[0],s[4]),rows["old"]!!.segments)
        assertFalse(rows.containsKey("foreign"))
        assertNull(CustomerSegmentationPreview.classify(owner,"other","b",records,now))
        assertNull(CustomerSegmentationPreview.classify(owner,"o","b",records+records,now))
    }
    @Test fun audienceRequiresFreshConsent() {
        val channel=MarketingConsentPreview.Channel.EMAIL
        val consent=MarketingConsentPreview.Consent("b","new",channel,"new@example.com",true,1,now-1)
        val contact=CustomerSegmentationPreview.Contact("new",consent.recipient,consent,consent,false)
        fun audience(c:List<CustomerSegmentationPreview.Contact>,enabled:Boolean=true)=
            CustomerSegmentationPreview.audience(owner,"o","b",records,c,now,channel,null,enabled)
        assertEquals(listOf("new"),audience(listOf(contact)))
        assertEquals(emptyList<String>(),audience(listOf(contact.copy(suppressed=true))))
        assertEquals(emptyList<String>(),audience(listOf(contact.copy(current=consent.copy(allowed=false,revision=2)))))
        assertEquals(emptyList<String>(),audience(listOf(contact),false))
        assertNull(audience(listOf(contact,contact)))
    }
}

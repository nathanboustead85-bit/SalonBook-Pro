package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerPrivacyPreviewTest {
    private val p=CustomerProfilePreview.Record("owner","client","Client","client@example.invalid",null,1)
    private val request=CustomerPrivacyPreview.Request("owner","client",1,CustomerPrivacyPreview.Kind.ACCESS,true)
    @Test fun exportRequiresScopedVerifiedFreshRequest() {
        assertEquals(p,CustomerPrivacyPreview.exportPreview(p,request,"owner","owner",true))
        assertNull(CustomerPrivacyPreview.exportPreview(p,request,"owner","owner",false))
        assertNull(CustomerPrivacyPreview.exportPreview(p,request.copy(verified=false),"owner","owner",true))
        assertNull(CustomerPrivacyPreview.exportPreview(p,request.copy(revision=2),"owner","owner",true))
        assertNull(CustomerPrivacyPreview.exportPreview(p,request.copy(customerId="other"),"owner","owner",true))
        assertNull(CustomerPrivacyPreview.exportPreview(p,request.copy(businessId="other"),"owner","owner",true))
        assertNull(CustomerPrivacyPreview.exportPreview(p,request,"other","other",true))
    }
    @Test fun erasureIsReviewOnly() {
        val erase=request.copy(kind=CustomerPrivacyPreview.Kind.ERASURE)
        assertEquals(CustomerPrivacyPreview.Decision.REVIEW_RETENTION,CustomerPrivacyPreview.plan(p,erase,"owner","owner",true)!!.decision)
        assertEquals(CustomerPrivacyPreview.Decision.REVIEW_ERASURE,CustomerPrivacyPreview.plan(p,erase,"owner","owner",false)!!.decision)
        assertNull(CustomerPrivacyPreview.exportPreview(p,erase,"owner","owner",true))
        assertEquals("Client",p.name)
    }
}

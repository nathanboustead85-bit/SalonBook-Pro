package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerDuplicatePreviewTest {
    private val a=CustomerProfilePreview.Record("owner","a","Alice","alice@example.invalid","+44 7700 900123",1)
    private val b=a.copy(customerId="b",name="ALICE",phone="+447700900123")
    @Test fun scopedNonDestructiveApproval() {
        val plan=CustomerDuplicatePreview.preview(a,b,"owner","owner")!!
        assertEquals(3,plan.matches.size)
        assertTrue(CustomerDuplicatePreview.approvePreview(plan,a,b,"owner","owner",true))
        assertFalse(CustomerDuplicatePreview.approvePreview(plan,a,b,"owner","owner",false))
        assertFalse(CustomerDuplicatePreview.approvePreview(plan,a,b.copy(revision=2),"owner","owner",true))
        assertFalse(CustomerDuplicatePreview.approvePreview(plan,a,b,"other","other",true))
        assertNull(CustomerDuplicatePreview.preview(a,b.copy(businessId="other"),"owner","owner"))
        assertNull(CustomerDuplicatePreview.preview(a,a,"owner","owner"))
        assertEquals("a",a.customerId)
        assertEquals("b",b.customerId)
    }
    @Test fun ambiguousMatchesBlocked() {
        val conflict=b.copy(email="different@example.invalid")
        val plan=CustomerDuplicatePreview.preview(a,conflict,"owner","owner")!!
        assertTrue(plan.conflictingContact)
        assertFalse(CustomerDuplicatePreview.approvePreview(plan,a,conflict,"owner","owner",true))
        val nameOnly=b.copy(email=null,phone=null)
        val weak=CustomerDuplicatePreview.preview(a,nameOnly,"owner","owner")!!
        assertFalse(CustomerDuplicatePreview.approvePreview(weak,a,nameOnly,"owner","owner",true))
        assertNull(CustomerDuplicatePreview.preview(a,nameOnly.copy(name="Bob"),"owner","owner"))
    }
}

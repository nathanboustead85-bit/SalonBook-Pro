package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class PromotionPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val now=java.time.Instant.parse("2026-11-26T09:00:00Z").toEpochMilli()
    private val at=now+3600000L
    private val offer=PromotionPreview.Offer("b","SAVE20",1,true,PromotionPreview.Kind.PERCENT,20,now-1,now+86400000,2)
    private val ledger=PromotionPreview.Ledger("b","SAVE20",1,emptyList())
    private val past=CustomerAppointmentHistoryPreview.Entry("b","c","past",now-1,"cut","staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED)
    private fun apply(o:PromotionPreview.Offer=offer,l:PromotionPreview.Ledger=ledger,
        current:PromotionPreview.Ledger=l,history:List<CustomerAppointmentHistoryPreview.Entry> = emptyList(),
        customer:String="c",booking:String="booking",confirmed:Boolean=true)=
        PromotionPreview.apply(owner,"o","b",o,o,l,current,"SAVE20",booking,customer,2500,at,now,history,confirmed)
    @Test fun discountsAndLimits() {
        val result=apply()!!
        assertEquals(500L,result.discountPence)
        assertEquals(2L,result.ledger.revision)
        assertTrue(ledger.uses.isEmpty())
        assertNull(apply(l=result.ledger))
        assertNull(apply(l=result.ledger,booking="other"))
        assertNull(apply(l=result.ledger,customer="other"))
        assertNull(apply(current=result.ledger))
        val second=apply(l=result.ledger,customer="other",booking="other")!!
        assertNull(apply(l=second.ledger,customer="third",booking="third"))
        assertEquals(2500L,apply(offer.copy(kind=PromotionPreview.Kind.FIXED,value=3000))!!.discountPence)
        assertNull(apply(offer.copy(value=101)))
    }
    @Test fun eligibility() {
        assertNull(apply(offer.copy(expiresAt=now)))
        assertNull(apply(offer.copy(startsAt=now+1)))
        assertNull(apply(offer.copy(expiresAt=at)))
        assertNull(apply(offer.copy(firstVisitOnly=true),history=listOf(past)))
        assertNotNull(apply(offer.copy(firstVisitOnly=true),history=listOf(past.copy(businessId="other"))))
        assertNotNull(apply(offer.copy(quietFromHour=10,quietUntilHour=11)))
        assertNull(apply(offer.copy(quietFromHour=11,quietUntilHour=12)))
        assertNull(apply(offer.copy(quietFromHour=10)))
        assertNull(apply(offer.copy(businessId="other")))
        assertNull(apply(confirmed=false))
        assertNull(apply(history=listOf(past,past)))
        assertNull(PromotionPreview.apply(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",offer,offer,ledger,ledger,"SAVE20","booking","c",2500,at,now,emptyList(),true))
    }
}

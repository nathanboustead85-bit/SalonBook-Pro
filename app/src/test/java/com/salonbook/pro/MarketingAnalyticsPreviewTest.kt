package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.math.BigDecimal

class MarketingAnalyticsPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val kind=MarketingAnalyticsPreview.Kind.REENGAGEMENT
    private val event=MarketingAnalyticsPreview.Event("b","e","c",kind,100,150,"booking",500,2000,100)
    private val unused=event.copy(id="u",customerId="d",redeemedAt=null,bookingId=null,discountPence=0,attributedMarginPence=0,campaignCostPence=400)
    private fun report(rows:List<MarketingAnalyticsPreview.Event>,member:EmployeeAccessPreview.Membership=owner)=
        MarketingAnalyticsPreview.calculate(member,"o","b",rows,100,200,300)
    @Test fun cohortsAndRoi() {
        val row=report(listOf(event,unused))!!.single{it.kind==kind}
        assertEquals(2,row.issued)
        assertEquals(1,row.redeemed)
        assertEquals(500L,row.discountPence)
        assertEquals(500L,row.campaignCostPence)
        assertEquals(BigDecimal("50.00"),row.redemptionPercent)
        assertEquals(BigDecimal("50.00"),row.customerUptakePercent)
        assertEquals(BigDecimal("100.00"),row.roiPercent)
        assertEquals(0,report(listOf(event.copy(redeemedAt=200)))!!.single{it.kind==kind}.redeemed)
        assertNull(report(emptyList())!!.first().roiPercent)
        for(k in MarketingAnalyticsPreview.Kind.values()) {
            assertEquals(1,report(listOf(event.copy(kind=k)))!!.single{it.kind==k}.redeemed)
        }
    }
    @Test fun invalidAndTenantIsolation() {
        assertNull(report(listOf(event,event)))
        assertNull(report(listOf(event,event.copy(id="other"))))
        assertNull(report(listOf(event.copy(redeemedAt=99))))
        assertNull(report(listOf(event.copy(discountPence=-1))))
        assertNull(report(listOf(unused.copy(discountPence=1))))
        assertNull(report(listOf(event),owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
        assertEquals(0,report(listOf(event.copy(businessId="other")))!!.sumOf{it.issued})
        assertNull(report(listOf(event.copy(discountPence=Long.MAX_VALUE),event.copy(id="other",bookingId="other"))))
    }
}

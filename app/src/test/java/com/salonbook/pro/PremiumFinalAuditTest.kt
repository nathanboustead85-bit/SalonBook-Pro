package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class PremiumFinalAuditTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val now=1800000000000L
    private val day=86400000L
    private val start=now+day
    private val end=start+3600000L
    private val booking=NotificationSafetyPolicy.BookingSnapshot("b","cancel",1,true,true,"test@example.invalid",true,true)
    private val canceled=AppointmentCancellationPreview.Appointment(SecureReminderPlan.Snapshot(booking,"original",start),"staff",end)
    private val slot=WaitingListPreview.Slot("b","cancel","cut","staff",start,end)
    private val request=WaitingListPreview.Request("b","r","c","cut","staff",start,end,1800000L,now,now+day)
    private val waiting=WaitingListPreview.Ledger("b",1,listOf(request))
    private val emptyHold=SlotRecoveryPreview.State(slot,1,emptyList())
    private val schedule=AppointmentGapPreview.Snapshot("b",1,listOf(OccupancyReportPreview.Window("b","staff",start,end)),emptyList(),emptyList(),emptyList(),emptyList())
    @Test fun waitingRecoveryGapAddonAndSharedGuard() {
        assertEquals(listOf("r"),WaitingListPreview.match(owner,"o","b",waiting,waiting,slot,canceled,emptyList(),now))
        val hold=SlotRecoveryPreview.advance(owner,"o","b",emptyHold,emptyHold,waiting,waiting,canceled,emptyList(),now,15)!!
        val held=schedule.copy(holds=listOf(hold))
        assertTrue(AppointmentGapPreview.rank(owner,"o","b",held,held,"staff","other",30,start,end,now)!!.isEmpty())
        val draft=ServiceAddonPreview.Draft("b","draft","other","staff",start,listOf("cut"),1)
        val catalogue=ServiceAddonPreview.Catalogue("b",1,listOf(
            ServiceAddonPreview.Service("cut","Cut",2000,30,setOf("staff"),emptySet(),true),
            ServiceAddonPreview.Service("beard","Beard",1000,15,setOf("staff"),setOf("cut"),true)))
        assertTrue(ServiceAddonPreview.recommend(owner,"o","b",draft,draft,catalogue,catalogue,held,held,null,now)!!.isEmpty())
        val declined=SlotRecoveryPreview.respond(owner,"o","b",hold,hold,waiting,waiting,canceled,emptyList(),"c","r",false,now)!!
        val free=schedule.copy(holds=listOf(declined))
        val quote=ServiceAddonPreview.recommend(owner,"o","b",draft,draft,catalogue,catalogue,free,free,null,now)!!.single()
        assertEquals(3000L,quote.totalPence)
        assertEquals(45,quote.totalMinutes)
        assertNull(ServiceAddonPreview.approve(owner,"o","b",draft,draft,catalogue,catalogue,free,free,null,quote,"wrong",true,now))
        val state=PremiumIntegrationPreview.State("b",1,free,emptyList(),emptyList())
        val claim=PremiumIntegrationPreview.Claim("a",PremiumIntegrationPreview.Kind.ADDON,"staff","other",start,start+2700000L)
        val reserved=PremiumIntegrationPreview.reserve(owner,"o","b",state,state,listOf(claim),now)!!
        assertNull(PremiumIntegrationPreview.reserve(owner,"o","b",reserved,reserved,listOf(claim.copy(id="rec",kind=PremiumIntegrationPreview.Kind.RECURRENCE)),now))
        assertTrue(emptyHold.offers.isEmpty())
        assertEquals(listOf("cut"),draft.serviceIds)
    }
    @Test fun roleMatrixAndLiveFlags() {
        for(role in EmployeeAccessPreview.Role.values()) for(active in listOf(true,false)) for(tenant in listOf("b","foreign")) {
            val member=owner.copy(role=role,active=active,businessId=tenant)
            val permitted=role==EmployeeAccessPreview.Role.OWNER && active && tenant=="b"
            val state=PremiumIntegrationPreview.State("b",1,schedule,emptyList(),emptyList())
            assertEquals(permitted,PremiumIntegrationPreview.contact(member,"o","b",state,state,"event","c",now)!=null)
            assertEquals(permitted,WaitingListPreview.match(member,"o","b",waiting,waiting,slot,canceled,emptyList(),now)!=null)
            val range=ReportingPeriodPreview.Range(now-28*day,now)
            assertEquals(permitted,BusinessInsightsPreview.analyse(member,"o","b",emptyList(),emptyList(),range,now)!=null)
        }
        assertFalse(NotificationSafetyPolicy.LIVE_EMAIL_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_WHATSAPP_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_BOOKING_ENABLED)
    }
}

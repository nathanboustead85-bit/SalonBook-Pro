package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class PremiumIntegrationPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val now=1800000000000L
    private val start=now+3600000L
    private val end=start+1800000L
    private val schedule=AppointmentGapPreview.Snapshot("b",1,
        listOf(OccupancyReportPreview.Window("b","staff",start,end+3600000L),
            OccupancyReportPreview.Window("b","other",start,end+3600000L)),emptyList(),emptyList(),emptyList(),emptyList())
    private val state=PremiumIntegrationPreview.State("b",1,schedule,emptyList(),emptyList())
    private fun claim(kind:PremiumIntegrationPreview.Kind,id:String=kind.name)=
        PremiumIntegrationPreview.Claim(id,kind,"staff","c",start,end)
    private fun reserve(s:PremiumIntegrationPreview.State,c:List<PremiumIntegrationPreview.Claim>,current:PremiumIntegrationPreview.State=s)=
        PremiumIntegrationPreview.reserve(owner,"o","b",s,current,c,now)
    @Test fun allCrossFeaturePairsAndAtomicBatch() {
        for(a in PremiumIntegrationPreview.Kind.values()) for(b in PremiumIntegrationPreview.Kind.values()) {
            val first=reserve(state,listOf(claim(a)))!!
            assertNull(reserve(first,listOf(claim(b,"second"))))
            assertNull(reserve(first,listOf(claim(b,"second").copy(staffId="other"))))
            assertNull(reserve(state,listOf(claim(a),claim(b,"second"))))
            assertNull(reserve(state,listOf(claim(b)),first))
            assertEquals(2,reserve(first,listOf(claim(b,"second").copy(start=end,end=end+1800000L)))!!.claims.size)
        }
        assertTrue(state.claims.isEmpty())
    }
    @Test fun protectedOffersAndRecurringBlockAddons() {
        val slot=WaitingListPreview.Slot("b","cancel","cut","staff",start,end)
        val hold=SlotRecoveryPreview.State(slot,1,listOf(SlotRecoveryPreview.Offer("r","c",now-1,now+60000,SlotRecoveryPreview.Status.PENDING)))
        val held=state.copy(schedule=schedule.copy(holds=listOf(hold)))
        assertNull(reserve(held,listOf(claim(PremiumIntegrationPreview.Kind.ADDON))))
        val recurring=RecurringAppointmentPreview.Occurrence("b","series",0,"c","cut","other",start,end)
        val booked=state.copy(schedule=schedule.copy(recurring=listOf(recurring)))
        assertNull(reserve(booked,listOf(claim(PremiumIntegrationPreview.Kind.GAP))))
        assertNotNull(reserve(held.copy(schedule=held.schedule.copy(holds=listOf(hold.copy(offers=listOf(hold.offers.single().copy(status=SlotRecoveryPreview.Status.DECLINED)))))),listOf(claim(PremiumIntegrationPreview.Kind.GAP))))
    }
    @Test fun sharedContactCooldownAndPrivacy() {
        val first=PremiumIntegrationPreview.contact(owner,"o","b",state,state,"rebook","c",now)!!
        assertNull(PremiumIntegrationPreview.contact(owner,"o","b",first,first,"no-show","c",now))
        assertNull(PremiumIntegrationPreview.contact(owner,"o","b",state,first,"no-show","c",now))
        assertNotNull(PremiumIntegrationPreview.contact(owner,"o","b",first,first,"no-show","other",now))
        assertNull(PremiumIntegrationPreview.contact(owner.copy(businessId="other"),"o","b",state,state,"x","c",now))
        assertNull(PremiumIntegrationPreview.reserve(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",state,state,listOf(claim(PremiumIntegrationPreview.Kind.GAP)),now))
        assertTrue(state.contacts.isEmpty())
    }
}

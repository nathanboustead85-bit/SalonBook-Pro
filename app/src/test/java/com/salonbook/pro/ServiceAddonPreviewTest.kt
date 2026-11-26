package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class ServiceAddonPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val start=10000000L
    private val draft=ServiceAddonPreview.Draft("b","d","c","staff",start,listOf("cut"),1)
    private val cat=ServiceAddonPreview.Catalogue("b",1,listOf(
        ServiceAddonPreview.Service("cut","Haircut",2000,30,setOf("staff"),emptySet(),true),
        ServiceAddonPreview.Service("beard","Beard",1000,15,setOf("staff"),setOf("cut"),true),
        ServiceAddonPreview.Service("wash","Wash",500,10,setOf("staff"),setOf("cut"),true),
        ServiceAddonPreview.Service("nails","Nails",1500,30,setOf("staff"),emptySet(),true)))
    private val schedule=AppointmentGapPreview.Snapshot("b",1,listOf(OccupancyReportPreview.Window("b","staff",start,start+3600000)),emptyList(),emptyList(),emptyList(),emptyList())
    private val pref=CustomerPreferencesPreview.State("b","c",1,favoriteServiceIds=listOf("wash"))
    private fun recommend(s:AppointmentGapPreview.Snapshot=schedule,p:CustomerPreferencesPreview.State=pref,
        member:EmployeeAccessPreview.Membership=owner)=ServiceAddonPreview.recommend(member,"o","b",draft,draft,cat,cat,s,s,p,start-1)
    private fun approve(q:ServiceAddonPreview.Quote,confirmed:Boolean=true,customer:String="c",current:ServiceAddonPreview.Draft=draft,
        catalogue:ServiceAddonPreview.Catalogue=cat)=ServiceAddonPreview.approve(owner,"o","b",draft,current,catalogue,catalogue,schedule,schedule,pref,q,customer,confirmed,start-1)
    @Test fun relevancePriceAndApproval() {
        val quotes=recommend()!!
        assertEquals(listOf("wash","beard"),quotes.map{it.addonId})
        val q=quotes.last()
        assertEquals(1000L,q.extraPence)
        assertEquals(3000L,q.totalPence)
        assertEquals(45,q.totalMinutes)
        assertNull(approve(q,false))
        assertNull(approve(q,customer="other"))
        assertNull(approve(q.copy(totalPence=1)))
        val next=approve(q)!!
        assertEquals(listOf("cut","beard"),next.serviceIds)
        assertEquals(listOf("cut"),draft.serviceIds)
        assertNull(approve(q,current=next))
        assertNull(approve(q,catalogue=cat.copy(revision=2)))
    }
    @Test fun availabilityAndPrivacy() {
        assertTrue(recommend(schedule.copy(blocked=listOf(OccupancyReportPreview.Window("b","staff",start+1800000,start+3600000))))!!.isEmpty())
        assertNull(recommend(p=pref.copy(customerId="other")))
        assertNull(recommend(member=owner.copy(businessId="other")))
        assertNull(recommend(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
    }
}

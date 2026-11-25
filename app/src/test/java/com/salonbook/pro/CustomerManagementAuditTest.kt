package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerManagementAuditTest {
    @Test fun combinedLifecyclePreservesSourceAndRejectsCrossTenantAccess() {
        val a=CustomerProfilePreview.Record("owner","client","Alice","alice@example.invalid",null,1)
        val duplicate=a.copy(customerId="duplicate")
        val foreign=a.copy(businessId="foreign")
        val records=listOf(a,duplicate,foreign)
        val appointment=CustomerAppointmentHistoryPreview.Entry("owner","client","booking",100,"Cut","Staff",2000,CustomerAppointmentHistoryPreview.Status.BOOKED)
        val appointments=listOf(appointment,appointment.copy(businessId="foreign"))
        val prefs=CustomerPreferencesPreview.State("owner","client",0)
        val request=CustomerPrivacyPreview.Request("owner","client",1,CustomerPrivacyPreview.Kind.ACCESS,true)
        val merge=CustomerDuplicatePreview.preview(a,duplicate,"owner","owner")!!
        val updated=CustomerProfilePreview.edit(a,a,"owner","owner","client","Alice Updated",a.email,null)!!
        assertEquals(2L,updated.revision)
        assertNull(CustomerProfilePreview.edit(a,updated,"owner","owner","client","Old",null,null))
        assertFalse(CustomerDuplicatePreview.approvePreview(merge,updated,duplicate,"owner","owner",true))
        assertNull(CustomerPrivacyPreview.exportPreview(updated,request,"owner","owner",true))
        assertEquals(listOf(appointment),CustomerAppointmentHistoryPreview.read(updated,"owner","owner","client",appointments,50)!!.upcoming)
        assertEquals(2,CustomerSearchPreview.search(records,"owner","owner","Alice")!!.total)
        assertNull(CustomerProfilePreview.read(a,"foreign","foreign","client"))
        assertNull(CustomerAppointmentHistoryPreview.read(a,"foreign","foreign","client",appointments,50))
        assertNull(CustomerPreferencesPreview.read(a,prefs,"foreign","foreign","client"))
        assertNull(CustomerPreferencesPreview.edit(a,prefs,prefs,"foreign","foreign","client",null,emptyList(),"","private"))
        assertNull(CustomerDuplicatePreview.preview(a,foreign,"owner","owner"))
        assertNull(CustomerPrivacyPreview.exportPreview(a,request,"foreign","foreign",true))
        assertNull(CustomerSearchPreview.search(records,"owner","foreign","Alice"))
        assertEquals(listOf(a,duplicate,foreign),records)
        assertEquals("Alice",a.name)
        assertEquals("client",appointment.customerId)
        assertEquals("",prefs.privateNotes)
    }
}

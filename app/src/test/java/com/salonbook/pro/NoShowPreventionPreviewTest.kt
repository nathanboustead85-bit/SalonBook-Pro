package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class NoShowPreventionPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val day=86400000L
    private val now=1800000000000L
    private val booking=SecureReminderPlan.Snapshot(NotificationSafetyPolicy.BookingSnapshot("b","future",1,true,false,"test@example.invalid",true,true),"c",now+day)
    private val consent=NotificationPreferences.CustomerConsent("c",true,false,now-day)
    private val settings=NotificationPreferences.BusinessSettings(true,true,true,true,false)
    private val ledger=NoShowPreventionPreview.Ledger("b",1,emptyList())
    private val history=(1..3).map{NoShowPreventionPreview.Attendance("b","c","v"+it,now-it*day,now-it*day+60000,
        if(it==3) NoShowPreventionPreview.Outcome.ATTENDED else NoShowPreventionPreview.Outcome.MISSED)}
    private fun propose(h:List<NoShowPreventionPreview.Attendance> = history,l:NoShowPreventionPreview.Ledger=ledger,
        c:NotificationPreferences.CustomerConsent?=consent,cc:NotificationPreferences.CustomerConsent?=c,
        member:EmployeeAccessPreview.Membership=owner,confirmed:Boolean=false,extra:Boolean=false,suppressed:Boolean=false)=
        NoShowPreventionPreview.propose(member,"o","b",booking,booking,h,h,l,l,c,cc,settings,settings,confirmed,extra,suppressed,now)
    @Test fun proportionateAndNoDuplicate() {
        val p=propose()!!
        assertEquals(NoShowPreventionPreview.Action.CONFIRMATION_REQUEST,p.action)
        assertEquals(NoShowPreventionPreview.Action.EXTRA_REMINDER,propose(confirmed=true)!!.action)
        assertNull(propose(l=p.ledger))
        assertNull(propose(extra=true))
        assertNull(propose(h=history.take(2)))
        assertNull(propose(h=history.map{it.copy(outcome=NoShowPreventionPreview.Outcome.CANCELED)}))
        assertNull(propose(h=history.map{it.copy(outcome=NoShowPreventionPreview.Outcome.UNKNOWN)}))
        assertNull(propose(h=history.map{it.copy(appointmentAt=it.appointmentAt-181*day,recordedAt=it.recordedAt-181*day)}))
        assertTrue(ledger.events.isEmpty())
        assertFalse(booking.booking.canceled)
    }
    @Test fun consentAndTenantIsolation() {
        assertNull(propose(c=null))
        assertNull(propose(cc=NotificationPreferences.withdrawConsent(consent,now)))
        assertNull(propose(c=NotificationPreferences.withdrawConsent(consent,now)))
        assertNull(propose(suppressed=true))
        assertNull(propose(member=owner.copy(businessId="other")))
        assertNull(propose(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
        assertNull(propose(h=history.map{it.copy(businessId="other")}))
        assertNull(propose(h=history.map{it.copy(customerId="other")}))
        assertNull(propose(h=history+history.first()))
    }
}

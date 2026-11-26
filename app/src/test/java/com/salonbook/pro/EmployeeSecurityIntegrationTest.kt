package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class EmployeeSecurityIntegrationTest {
    @Test fun invitationThroughRevocationWithAudit() {
        val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
        val invite=EmployeeInvitationPreview.issue(owner,"o","b","i","e",EmployeeAccessPreview.Role.EMPLOYEE,100,200)!!
        val accepted=EmployeeInvitationPreview.accept(invite,invite,"b","e",110)!!
        assertEquals(EmployeeInvitationPreview.Status.ACCEPTED,accepted.status)
        assertNull(EmployeeInvitationPreview.accept(invite,accepted,"b","e",111))
        // Synthetic trusted account-linking adapter; no real account is created.
        val member=EmployeeAccessPreview.Membership(accepted.businessId,accepted.recipientId,accepted.role,true,1)
        val state=EmployeeLifecyclePreview.State(member,EmployeeLifecyclePreview.Status.ACTIVE)
        val own=EmployeePermissionPreview.Grant.OWN_APPOINTMENTS
        val edit=EmployeePermissionPreview.Grant.EDIT_BOOKINGS
        val initial=EmployeePermissionPreview.Policy("b","e",1,0,setOf(own,edit))
        val phone=EmployeeSessionPreview.Session("s","b","e","phone",1,0,111,200)
        val tablet=phone.copy(id="t",deviceId="tablet")
        val booking=EmployeeAppointmentAccessPreview.Resource("b","a","e",1,false)
        fun allowed(s:EmployeeSessionPreview.Session,p:EmployeePermissionPreview.Policy,m:EmployeeLifecyclePreview.State,
            action:EmployeeAppointmentAccessPreview.Action)=EmployeeAppointmentAccessPreview.allows(
                s,s,m,p,"e","b",s.deviceId,120,booking,booking,action)
        val action=EmployeeAppointmentAccessPreview.Action.EDIT
        assertTrue(allowed(phone,initial,state,action))
        assertTrue(allowed(tablet,initial,state,action))
        val reduced=EmployeePermissionPreview.change(owner,"o","b",member,initial,initial,setOf(own))!!
        assertFalse(allowed(phone,reduced,state,action))
        assertFalse(allowed(tablet,reduced,state,action))
        val renewed=phone.copy(policyRevision=reduced.revision)
        assertTrue(allowed(renewed,reduced,state,EmployeeAppointmentAccessPreview.Action.VIEW))
        assertFalse(allowed(renewed,reduced,state,action))
        val revoked=EmployeeLifecyclePreview.change(owner,"o","b",state,state,EmployeeLifecyclePreview.Status.REVOKED)!!
        assertFalse(allowed(renewed,reduced,revoked,EmployeeAppointmentAccessPreview.Action.VIEW))
        assertNull(EmployeeLifecyclePreview.change(owner,"o","b",revoked,revoked,EmployeeLifecyclePreview.Status.ACTIVE))
        var events=emptyList<EmployeeAuditPreview.Event>()
        for((index,event) in listOf(EmployeeAuditPreview.Action.INVITED,EmployeeAuditPreview.Action.PERMISSIONS_CHANGED,EmployeeAuditPreview.Action.REVOKED).withIndex()) {
            events=EmployeeAuditPreview.append(owner,"o","b",events,events,"e",event,130L+index)!!
        }
        assertEquals(3,EmployeeAuditPreview.read(owner,"o","b",events)!!.size)
        assertNull(EmployeeAuditPreview.read(owner,"o","other",events))
        assertNull(EmployeeAuditPreview.read(owner,"o","b",events.reversed()))
        assertEquals(1L,booking.revision)
        assertEquals("e",booking.staffUserId)
    }
}

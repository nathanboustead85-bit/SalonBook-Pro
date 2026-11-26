package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeeLifecyclePreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val member=EmployeeAccessPreview.Membership("b","e",EmployeeAccessPreview.Role.EMPLOYEE,true,1)
    private val active=EmployeeLifecyclePreview.State(member,EmployeeLifecyclePreview.Status.ACTIVE)
    private val grant=EmployeePermissionPreview.Grant.OWN_APPOINTMENTS
    private val policy=EmployeePermissionPreview.Policy("b","e",1,0,setOf(grant))
    @Test fun suspendReactivateAndRevoke() {
        val historical=CustomerAppointmentHistoryPreview.Entry("b","c","booking",100,"Cut","e",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED)
        assertTrue(EmployeeLifecyclePreview.allows(active,active,"e","b",policy,grant))
        val suspended=EmployeeLifecyclePreview.change(owner,"o","b",active,active,EmployeeLifecyclePreview.Status.SUSPENDED)!!
        assertFalse(EmployeeLifecyclePreview.allows(active,suspended,"e","b",policy,grant))
        assertFalse(EmployeeLifecyclePreview.allows(suspended,suspended,"e","b",policy,grant))
        val resumed=EmployeeLifecyclePreview.change(owner,"o","b",suspended,suspended,EmployeeLifecyclePreview.Status.ACTIVE)!!
        assertFalse(EmployeeLifecyclePreview.allows(resumed,resumed,"e","b",policy,grant))
        assertTrue(EmployeeLifecyclePreview.allows(resumed,resumed,"e","b",policy.copy(membershipRevision=3),grant))
        val revoked=EmployeeLifecyclePreview.change(owner,"o","b",resumed,resumed,EmployeeLifecyclePreview.Status.REVOKED)!!
        assertNull(EmployeeLifecyclePreview.change(owner,"o","b",revoked,revoked,EmployeeLifecyclePreview.Status.ACTIVE))
        assertFalse(EmployeeLifecyclePreview.allows(resumed,revoked,"e","b",policy,grant))
        assertEquals("e",historical.staff)
        assertEquals(member.userId,revoked.membership.userId)
        assertTrue(member.active)
    }
    @Test fun unauthorizedAndStaleChangesDenied() {
        val next=EmployeeLifecyclePreview.Status.REVOKED
        assertNull(EmployeeLifecyclePreview.change(member,"e","b",active,active,next))
        assertNull(EmployeeLifecyclePreview.change(owner,"o","other",active,active,next))
        assertNull(EmployeeLifecyclePreview.change(owner,"o","b",active,active.copy(membership=member.copy(revision=2)),next))
        val protected=active.copy(membership=owner)
        assertNull(EmployeeLifecyclePreview.change(owner,"o","b",protected,protected,next))
        val invalid=active.copy(membership=member.copy(active=false))
        assertNull(EmployeeLifecyclePreview.change(owner,"o","b",invalid,invalid,next))
    }
}

package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeeSessionPreviewTest {
    private val grant=EmployeePermissionPreview.Grant.OWN_APPOINTMENTS
    private val member=EmployeeLifecyclePreview.State(
        EmployeeAccessPreview.Membership("b","e",EmployeeAccessPreview.Role.EMPLOYEE,true,1),
        EmployeeLifecyclePreview.Status.ACTIVE)
    private val policy=EmployeePermissionPreview.Policy("b","e",1,2,setOf(grant))
    private val session=EmployeeSessionPreview.Session("s","b","e","phone",1,2,100,200)
    private fun allowed(candidate:EmployeeSessionPreview.Session?=session,current:EmployeeSessionPreview.Session?=session,
        state:EmployeeLifecyclePreview.State=member,p:EmployeePermissionPreview.Policy=policy,
        actor:String="e",business:String="b",device:String="phone",now:Long=150)=
        EmployeeSessionPreview.allows(candidate,current,state,p,actor,business,device,now,grant)
    @Test fun scopeAndTime() {
        assertTrue(allowed())
        assertFalse(allowed(now=99))
        assertFalse(allowed(now=200))
        assertFalse(allowed(device="tablet"))
        assertFalse(allowed(actor="other"))
        assertFalse(allowed(business="other"))
        assertFalse(allowed(current=null))
        assertFalse(allowed(current=session.copy(revoked=true)))
        val revoked=session.copy(revoked=true)
        assertFalse(allowed(candidate=revoked,current=revoked))
    }
    @Test fun freshPermissionsAndMembershipRequiredOnEveryDevice() {
        val tablet=session.copy(id="t",deviceId="tablet")
        assertTrue(allowed(candidate=tablet,current=tablet,device="tablet"))
        val changed=policy.copy(revision=3,grants=emptySet())
        assertFalse(allowed(p=changed))
        assertFalse(allowed(candidate=tablet,current=tablet,device="tablet",p=changed))
        assertFalse(allowed(p=policy.copy(revision=3)))
        assertFalse(allowed(p=policy.copy(businessId="other")))
        val suspended=member.copy(membership=member.membership.copy(active=false,revision=2),
            status=EmployeeLifecyclePreview.Status.SUSPENDED)
        assertFalse(allowed(state=suspended))
        assertFalse(allowed(candidate=tablet,current=tablet,device="tablet",state=suspended))
        val renewed=session.copy(policyRevision=3)
        assertFalse(allowed(candidate=renewed,current=renewed,p=changed))
        assertTrue(allowed(candidate=renewed,current=renewed,p=policy.copy(revision=3)))
    }
}

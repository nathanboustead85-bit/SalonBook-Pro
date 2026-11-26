package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeeAppointmentAccessPreviewTest {
    private val member=EmployeeLifecyclePreview.State(EmployeeAccessPreview.Membership("b","e",EmployeeAccessPreview.Role.EMPLOYEE,true,1),EmployeeLifecyclePreview.Status.ACTIVE)
    private val session=EmployeeSessionPreview.Session("s","b","e","phone",1,2,100,200)
    private val own=EmployeeAppointmentAccessPreview.Resource("b","booking","e",1,false)
    private val basic=setOf(EmployeePermissionPreview.Grant.OWN_APPOINTMENTS)
    private fun allowed(action:EmployeeAppointmentAccessPreview.Action,resource:EmployeeAppointmentAccessPreview.Resource=own,
        current:EmployeeAppointmentAccessPreview.Resource?=resource,grants:Set<EmployeePermissionPreview.Grant> = basic,
        state:EmployeeLifecyclePreview.State=member)=EmployeeAppointmentAccessPreview.allows(session,session,state,
        EmployeePermissionPreview.Policy("b","e",1,2,grants),"e","b","phone",150,resource,current,action)
    @Test fun scopeAndContact() {
        val view=EmployeeAppointmentAccessPreview.Action.VIEW
        val contact=EmployeeAppointmentAccessPreview.Action.CONTACT
        val other=own.copy(staffUserId="other")
        assertTrue(allowed(view))
        assertFalse(allowed(view,other))
        assertTrue(allowed(view,other,grants=setOf(EmployeePermissionPreview.Grant.ALL_APPOINTMENTS)))
        assertFalse(allowed(view,own.copy(businessId="other")))
        assertFalse(allowed(view,own,current=other))
        assertFalse(allowed(contact))
        assertTrue(allowed(contact,grants=basic+EmployeePermissionPreview.Grant.CUSTOMER_CONTACT))
        assertFalse(allowed(contact,other,grants=basic+EmployeePermissionPreview.Grant.CUSTOMER_CONTACT))
        assertFalse(allowed(view,state=member.copy(status=EmployeeLifecyclePreview.Status.SUSPENDED)))
    }
    @Test fun mutationsRequireExplicitGrantAndFreshResource() {
        val edit=EmployeeAppointmentAccessPreview.Action.EDIT
        val cancel=EmployeeAppointmentAccessPreview.Action.CANCEL
        val create=EmployeeAppointmentAccessPreview.Action.CREATE
        val editGrants=basic+EmployeePermissionPreview.Grant.EDIT_BOOKINGS
        assertFalse(allowed(edit))
        assertTrue(allowed(edit,grants=editGrants))
        assertFalse(allowed(edit,current=own.copy(revision=2),grants=editGrants))
        assertFalse(allowed(edit,own.copy(historical=true),grants=editGrants))
        assertFalse(allowed(cancel,grants=editGrants))
        assertTrue(allowed(cancel,grants=basic+EmployeePermissionPreview.Grant.CANCEL_BOOKINGS))
        assertFalse(allowed(cancel,own.copy(historical=true),grants=basic+EmployeePermissionPreview.Grant.CANCEL_BOOKINGS))
        val fresh=own.copy(revision=0)
        assertTrue(allowed(create,fresh,null,basic+EmployeePermissionPreview.Grant.CREATE_BOOKINGS))
        assertFalse(allowed(create,fresh,null,basic))
        assertFalse(allowed(create,fresh,fresh,basic+EmployeePermissionPreview.Grant.CREATE_BOOKINGS))
    }
}

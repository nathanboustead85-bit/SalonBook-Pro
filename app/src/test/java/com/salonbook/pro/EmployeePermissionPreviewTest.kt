package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeePermissionPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val employee=EmployeeAccessPreview.Membership("b","e",EmployeeAccessPreview.Role.EMPLOYEE,true,1)
    private val policy=EmployeePermissionPreview.Policy("b","e",1,0,emptySet())
    private val grant=EmployeePermissionPreview.Grant.CREATE_BOOKINGS
    @Test fun ownerCanGrantAndRevokeWithoutMutatingOriginal() {
        val grants=mutableSetOf(grant)
        val next=EmployeePermissionPreview.change(owner,"o","b",employee,policy,policy,grants)!!
        grants.clear()
        assertTrue(EmployeePermissionPreview.allows(employee,"e","b",next,grant))
        assertFalse(EmployeePermissionPreview.allows(employee,"e","b",policy,grant))
        val revoked=EmployeePermissionPreview.change(owner,"o","b",employee,next,next,emptySet())!!
        assertFalse(EmployeePermissionPreview.allows(employee,"e","b",revoked,grant))
        assertNull(EmployeePermissionPreview.change(owner,"o","b",employee,policy,next,setOf(grant)))
        assertFalse(EmployeePermissionPreview.allows(employee.copy(revision=2),"e","b",next,grant))
        assertFalse(EmployeePermissionPreview.allows(employee.copy(active=false),"e","b",next,grant))
        assertFalse(EmployeePermissionPreview.allows(employee,"e","other",next,grant))
    }
    @Test fun escalationDenied() {
        for(g in listOf(EmployeePermissionPreview.Grant.FINANCES,EmployeePermissionPreview.Grant.BILLING,EmployeePermissionPreview.Grant.BUSINESS_SETTINGS,EmployeePermissionPreview.Grant.MANAGE_STAFF)) {
            assertNull(EmployeePermissionPreview.change(owner,"o","b",employee,policy,policy,setOf(g)))
            assertFalse(EmployeePermissionPreview.allows(employee,"e","b",policy.copy(grants=setOf(g)),g))
        }
        assertNull(EmployeePermissionPreview.change(employee,"e","b",employee,policy,policy,setOf(grant)))
        assertNull(EmployeePermissionPreview.change(owner.copy(role=EmployeeAccessPreview.Role.MANAGER),"o","b",employee,policy,policy,setOf(grant)))
        assertNull(EmployeePermissionPreview.change(owner,"o","b",employee.copy(businessId="other"),policy,policy,setOf(grant)))
        assertNull(EmployeePermissionPreview.change(owner,"o","b",employee.copy(role=EmployeeAccessPreview.Role.OWNER),policy,policy,setOf(grant)))
    }
}

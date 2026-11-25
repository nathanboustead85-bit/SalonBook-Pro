package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeeAccessPreviewTest {
    private val m=EmployeeAccessPreview.Membership("business","user",EmployeeAccessPreview.Role.EMPLOYEE,true,1)
    @Test fun roleMatrix() {
        for(p in EmployeeAccessPreview.Permission.values()) {
            assertEquals(p==EmployeeAccessPreview.Permission.OWN_APPOINTMENTS,EmployeeAccessPreview.allows(m,"user","business",p))
            assertEquals(p in setOf(EmployeeAccessPreview.Permission.OWN_APPOINTMENTS,EmployeeAccessPreview.Permission.ALL_APPOINTMENTS,EmployeeAccessPreview.Permission.CUSTOMER_CONTACT),EmployeeAccessPreview.allows(m.copy(role=EmployeeAccessPreview.Role.MANAGER),"user","business",p))
            assertTrue(EmployeeAccessPreview.allows(m.copy(role=EmployeeAccessPreview.Role.OWNER),"user","business",p))
        }
    }
    @Test fun invalidMembershipDeniedForEveryPermission() {
        for(p in EmployeeAccessPreview.Permission.values()) {
            assertFalse(EmployeeAccessPreview.allows(m,"other","business",p))
            assertFalse(EmployeeAccessPreview.allows(m,"user","other",p))
            assertFalse(EmployeeAccessPreview.allows(m.copy(active=false),"user","business",p))
            assertFalse(EmployeeAccessPreview.allows(m.copy(revision=0),"user","business",p))
            assertFalse(EmployeeAccessPreview.allows(null,"user","business",p))
        }
    }
}

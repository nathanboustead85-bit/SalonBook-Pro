package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeeInvitationPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val role=EmployeeAccessPreview.Role.EMPLOYEE
    private fun issue()=EmployeeInvitationPreview.issue(owner,"o","b","invite","e",role,100,200)!!
    @Test fun acceptanceIsScopedAndSingleUseAgainstCurrentState() {
        val i=issue()
        val accepted=EmployeeInvitationPreview.accept(i,i,"b","e",199)!!
        assertEquals(EmployeeInvitationPreview.Status.ACCEPTED,accepted.status)
        assertEquals(role,accepted.role)
        assertNull(EmployeeInvitationPreview.accept(i,accepted,"b","e",199))
        assertNull(EmployeeInvitationPreview.accept(accepted,accepted,"b","e",199))
        assertNull(EmployeeInvitationPreview.accept(i,i,"b","e",200))
        assertNull(EmployeeInvitationPreview.accept(i,i,"b","e",99))
        assertNull(EmployeeInvitationPreview.accept(i,i,"other","e",150))
        assertNull(EmployeeInvitationPreview.accept(i,i,"b","other",150))
        assertNull(EmployeeInvitationPreview.accept(i.copy(role=EmployeeAccessPreview.Role.MANAGER),i,"b","e",150))
        assertNull(EmployeeInvitationPreview.accept(i.copy(role=EmployeeAccessPreview.Role.OWNER),i.copy(role=EmployeeAccessPreview.Role.OWNER),"b","e",150))
    }
    @Test fun ownerOnlyIssueAndCancel() {
        val i=issue()
        assertNull(EmployeeInvitationPreview.issue(owner,"o","b","invite","e",EmployeeAccessPreview.Role.OWNER,100,200))
        assertNull(EmployeeInvitationPreview.issue(owner,"o","b","invite","e",role,100,100))
        assertNull(EmployeeInvitationPreview.issue(owner,"o","b","invite","e",role,100,604800101))
        assertNull(EmployeeInvitationPreview.issue(owner.copy(role=EmployeeAccessPreview.Role.MANAGER),"o","b","invite","e",role,100,200))
        assertNull(EmployeeInvitationPreview.cancel(owner,"other","b",i,i,150))
        assertNull(EmployeeInvitationPreview.cancel(owner,"o","other",i,i,150))
        val canceled=EmployeeInvitationPreview.cancel(owner,"o","b",i,i,150)!!
        assertEquals(EmployeeInvitationPreview.Status.CANCELED,canceled.status)
        assertNull(EmployeeInvitationPreview.accept(i,canceled,"b","e",150))
        assertNull(EmployeeInvitationPreview.cancel(owner,"o","b",canceled,canceled,150))
        assertEquals(EmployeeInvitationPreview.Status.PENDING,i.status)
    }
}

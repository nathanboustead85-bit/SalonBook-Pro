package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class EmployeeAuditPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val action=EmployeeAuditPreview.Action.PERMISSIONS_CHANGED
    private fun append(current:List<EmployeeAuditPreview.Event> = emptyList(),now:Long=100)=
        EmployeeAuditPreview.append(owner,"o","b",current,current,"e",action,now)!!
    @Test fun appendAndIntegrity() {
        val first=append()
        val second=append(first,101)
        assertEquals(1,first.size)
        assertEquals(2,second.size)
        assertEquals(first[0].digest,second[1].previous)
        assertEquals(second,EmployeeAuditPreview.read(owner,"o","b",second))
        assertNull(EmployeeAuditPreview.read(owner,"o","b",second.reversed()))
        assertNull(EmployeeAuditPreview.read(owner,"o","b",second.drop(1)))
        assertNull(EmployeeAuditPreview.read(owner,"o","b",listOf(first[0].copy(targetId="other"))))
        assertNull(EmployeeAuditPreview.append(owner,"o","b",first,second,"e",action,102))
        assertNull(EmployeeAuditPreview.append(owner,"o","b",second,second,"e",action,99))
    }
    @Test fun ownerOnlyAndScoped() {
        val events=append()
        val employee=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)
        assertNull(EmployeeAuditPreview.read(employee,"o","b",events))
        assertNull(EmployeeAuditPreview.read(owner,"o","other",events))
        assertNull(EmployeeAuditPreview.append(employee,"o","b",events,events,"e",action,101))
        assertNull(EmployeeAuditPreview.append(owner,"o","b",events,events,"",action,101))
        assertNull(EmployeeAuditPreview.append(owner,"o","b",events,events,"customer name",action,101))
        for(a in EmployeeAuditPreview.Action.values()) {
            assertNotNull(EmployeeAuditPreview.append(owner,"o","b",events,events,"opaque-id",a,101))
        }
    }
}

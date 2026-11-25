package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerProfileEditTest {
    private val original = CustomerProfilePreview.Record("owner","client","Original",null,null,1)
    private fun edit(name:String="New Name", email:String?="new@example.invalid", phone:String?="+44 7700 900123",
        candidate:CustomerProfilePreview.Record=original,current:CustomerProfilePreview.Record=original,
        owner:String="owner",requested:String="owner",customer:String="client") =
        CustomerProfilePreview.edit(candidate,current,owner,requested,customer,name,email,phone)
    @Test fun validEditPreservesIdentity() {
        val result = edit(name=" New Name ")!!
        assertEquals("New Name",result.name)
        assertEquals(2L,result.revision)
        assertEquals(original.businessId,result.businessId)
        assertEquals(original.customerId,result.customerId)
        assertEquals("Original",original.name)
        assertEquals(result,edit(name=result.name,email=result.email,phone=result.phone,candidate=result,current=result))
        assertNull(edit(candidate=original,current=result))
        assertNull(edit(candidate=original.copy(name="Changed")))
        assertNull(edit(owner="other",requested="other"))
        assertNull(edit(requested="other"))
        assertNull(edit(customer="other"))
        val max=original.copy(revision=Long.MAX_VALUE)
        assertNull(edit(candidate=max,current=max))
    }
    @Test fun invalidAndOptionalFields() {
        assertNull(edit(name=" "))
        assertNull(edit(name="x".repeat(121)))
        assertNull(edit(name="bad\nname"))
        assertNull(edit(email="bad"))
        assertNull(edit(email="a@b"))
        assertNull(edit(phone="123"))
        assertNull(edit(phone="abc123456789"))
        val cleared=edit(email=" ",phone=null)!!
        assertNull(cleared.email)
        assertNull(cleared.phone)
    }
}

package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerPreferencesPreviewTest {
    private val profile=CustomerProfilePreview.Record("owner","client","Client",null,null,1)
    private val state=CustomerPreferencesPreview.State("owner","client",0)
    private fun edit(candidate:CustomerPreferencesPreview.State=state,current:CustomerPreferencesPreview.State=state,
        owner:String="owner",requested:String="owner",staff:String?="staff",services:List<String> = listOf("cut"),notes:String="Private note") =
        CustomerPreferencesPreview.edit(profile,candidate,current,owner,requested,"client",staff,services,"Short sides",notes)
    @Test fun scopedEdits() {
        val services=mutableListOf("cut")
        val result=edit(services=services)!!
        services.clear()
        assertEquals(listOf("cut"),result.favoriteServiceIds)
        assertEquals(1L,result.revision)
        assertEquals("",state.privateNotes)
        assertNull(edit(current=result))
        assertNull(edit(owner="other",requested="other"))
        assertNull(edit(requested="other"))
        assertNull(CustomerPreferencesPreview.read(profile,result,"owner","owner","other"))
        assertEquals(result,CustomerPreferencesPreview.read(profile,result,"owner","owner","client"))
        assertEquals(result,edit(candidate=result,current=result))
    }
    @Test fun validation() {
        assertNull(edit(notes="x".repeat(2001)))
        assertNull(edit(notes="bad\u0000note"))
        assertNull(edit(staff=" "))
        assertNull(edit(services=listOf("cut","cut")))
        assertNull(edit(services=List(51){ "service"+it }))
        val max=state.copy(revision=Long.MAX_VALUE)
        assertNull(edit(candidate=max,current=max))
    }
}

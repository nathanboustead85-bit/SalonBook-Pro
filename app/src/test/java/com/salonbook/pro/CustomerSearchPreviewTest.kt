package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerSearchPreviewTest {
    private val a=CustomerProfilePreview.Record("owner","a","Alice Smith","alice@example.invalid","+44 7700 900123",1)
    private val z=CustomerProfilePreview.Record("owner","z","Zoe",null,null,1)
    private val records=listOf(z,a,a.copy(businessId="other",customerId="secret"))
    @Test fun searchAndScope() {
        fun search(q:String,field:CustomerSearchPreview.Field=CustomerSearchPreview.Field.ALL)=
            CustomerSearchPreview.search(records,"owner","owner",q,field)!!.records
        assertEquals(listOf(a),search("SMITH"))
        assertEquals(listOf(a),search("example",CustomerSearchPreview.Field.EMAIL))
        assertEquals(listOf(a),search("7700-900",CustomerSearchPreview.Field.PHONE))
        assertTrue(search("smith",CustomerSearchPreview.Field.EMAIL).isEmpty())
        assertEquals(listOf(a,z),search(""))
        assertNull(CustomerSearchPreview.search(records,"owner","other",""))
        assertEquals(listOf(a.copy(businessId="other",customerId="secret")),CustomerSearchPreview.search(records,"other","other","")!!.records)
    }
    @Test fun filtersAndBounds() {
        assertEquals(listOf(z),CustomerSearchPreview.search(records,"owner","owner","",filter=CustomerSearchPreview.Filter.MISSING_CONTACT)!!.records)
        val page=CustomerSearchPreview.search(records,"owner","owner","",offset=1,limit=1)!!
        assertEquals(2,page.total)
        assertEquals(listOf(z),page.records)
        assertNull(CustomerSearchPreview.search(records,"owner","owner","",limit=101))
        assertNull(CustomerSearchPreview.search(records,"owner","owner","",offset=-1))
        assertNull(CustomerSearchPreview.search(records,"owner","owner","bad\nquery"))
        assertNull(CustomerSearchPreview.search(records+a,"owner","owner",""))
        assertNull(CustomerSearchPreview.search(listOf(a.copy(revision=0)),"owner","owner",""))
    }
}

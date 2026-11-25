package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerProfilePreviewTest {
    @Test fun ownerScopedRead() {
        val record = CustomerProfilePreview.Record("owner","customer","Test Customer","test@example.invalid",null,1)
        assertEquals(record,CustomerProfilePreview.read(record,"owner","owner","customer"))
        assertNull(CustomerProfilePreview.read(record,"other","other","customer"))
        assertNull(CustomerProfilePreview.read(record,"owner","other","customer"))
        assertNull(CustomerProfilePreview.read(record,"owner","owner","different"))
        assertNull(CustomerProfilePreview.read(record,null,null,"customer"))
        assertNull(CustomerProfilePreview.read(record.copy(revision=0),"owner","owner","customer"))
        assertNull(CustomerProfilePreview.read(record.copy(name=" "),"owner","owner","customer"))
    }
}

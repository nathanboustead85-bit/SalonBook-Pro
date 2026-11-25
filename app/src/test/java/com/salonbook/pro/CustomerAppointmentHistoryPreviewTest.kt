package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class CustomerAppointmentHistoryPreviewTest {
    private val profile=CustomerProfilePreview.Record("owner","client","Client",null,null,1)
    private val past=CustomerAppointmentHistoryPreview.Entry("owner","client","past",10,"Cut","Staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED)
    private val future=past.copy(bookingId="future",startsAt=30,status=CustomerAppointmentHistoryPreview.Status.BOOKED)
    private val canceled=future.copy(bookingId="cancel",status=CustomerAppointmentHistoryPreview.Status.CANCELED)
    @Test fun scopedReadOnlyHistory() {
        val records=listOf(future,past,canceled,past.copy(businessId="other"),future.copy(customerId="other"))
        val result=CustomerAppointmentHistoryPreview.read(profile,"owner","owner","client",records,20)!!
        assertEquals(listOf(past),result.previous)
        assertEquals(listOf(future),result.upcoming)
        assertEquals(listOf(canceled),result.canceled)
        assertEquals(5,records.size)
        assertNull(CustomerAppointmentHistoryPreview.read(profile,"other","other","client",records,20))
        assertNull(CustomerAppointmentHistoryPreview.read(profile,"owner","owner","other",records,20))
        assertNull(CustomerAppointmentHistoryPreview.read(profile,"owner","other","client",records,20))
    }
    @Test fun invalidRecordsFailClosed() {
        for(records in listOf(listOf(past,past),listOf(past.copy(pricePence=-1)),listOf(past.copy(startsAt=0)),listOf(past.copy(bookingId=""))))
            assertNull(CustomerAppointmentHistoryPreview.read(profile,"owner","owner","client",records,20))
        assertNull(CustomerAppointmentHistoryPreview.read(profile,"owner","owner","client",emptyList(),0))
        assertTrue(CustomerAppointmentHistoryPreview.read(profile,"owner","owner","client",emptyList(),20)!!.previous.isEmpty())
    }
}

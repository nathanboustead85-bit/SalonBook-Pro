package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.time.*

class RecurringAppointmentPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val first=LocalDateTime.of(2027,1,31,10,0)
    private val series=RecurringAppointmentPreview.Series("b","s","c","cut","staff",first,RecurringAppointmentPreview.Frequency.MONTHLY,3,30)
    private val ledger=RecurringAppointmentPreview.Ledger("b",1,emptyList())
    private val now=Instant.parse("2026-11-26T00:00:00Z").toEpochMilli()
    private val working=listOf(RecurringAppointmentPreview.Window("b","staff",now,now+400*86400000L))
    private fun plan(s:RecurringAppointmentPreview.Series=series,l:RecurringAppointmentPreview.Ledger=ledger,
        absences:List<RecurringAppointmentPreview.Window> = emptyList(),member:EmployeeAccessPreview.Membership=owner,
        appointments:List<AppointmentCancellationPreview.Appointment> = emptyList())=
        RecurringAppointmentPreview.plan(member,"o","b",s,l,l,appointments,working,absences,now)
    @Test fun frequenciesAndLocalTime() {
        val monthly=plan()!!
        val zone=ZoneId.of("Europe/London")
        assertEquals(listOf(31,28,31),monthly.entries.map{Instant.ofEpochMilli(it.start).atZone(zone).dayOfMonth})
        assertTrue(monthly.entries.all{Instant.ofEpochMilli(it.start).atZone(zone).hour==10})
        for((frequency,days) in listOf(RecurringAppointmentPreview.Frequency.WEEKLY to 7L,RecurringAppointmentPreview.Frequency.FORTNIGHTLY to 14L)){
            val entries=plan(series.copy(frequency=frequency))!!.entries
            assertEquals(days*86400000L,entries[1].start-entries[0].start)
        }
        assertNull(plan(series.copy(first=LocalDateTime.of(2027,3,28,1,30))))
    }
    @Test fun conflictsPrivacyAndCancellation() {
        val l=plan()!!
        val e=l.entries[1]
        assertNull(plan(absences=listOf(RecurringAppointmentPreview.Window("b","staff",e.start,e.end))))
        assertNull(plan(l=l))
        assertNull(plan(series.copy(id="new"),l))
        assertNull(plan(member=owner.copy(businessId="other")))
        assertNull(plan(member=owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE)))
        val booking=NotificationSafetyPolicy.BookingSnapshot("b","existing",1,true,false,null,false,false)
        val appointment=AppointmentCancellationPreview.Appointment(SecureReminderPlan.Snapshot(booking,"other",e.start),"staff",e.end)
        assertNull(plan(appointments=listOf(appointment)))
        assertNull(plan(appointments=listOf(appointment.copy(staffId="other",snapshot=appointment.snapshot.copy(customerId="c")))))
        val one=RecurringAppointmentPreview.cancel(owner,"o","b",l,l,"s",1,now,true)!!
        assertEquals(1,one.entries.count{it.canceled})
        assertNull(RecurringAppointmentPreview.cancel(owner,"o","b",l,one,"s",null,now,true))
        val all=RecurringAppointmentPreview.cancel(owner,"o","b",one,one,"s",null,now,true)!!
        assertTrue(all.entries.all{it.canceled})
        assertTrue(l.entries.none{it.canceled})
        assertTrue(ledger.entries.isEmpty())
    }
}

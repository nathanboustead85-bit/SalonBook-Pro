package com.salonbook.pro
import java.time.LocalDate
import org.junit.Test
import org.junit.Assert.*
class RecurringDatesTest {
    @Test fun weeklyAndFortnightly() {
        val a = LocalDate.parse("2026-11-27")
        assertEquals(LocalDate.parse("2026-12-04"), RecurringDates.generate(a,0,1).single())
        assertEquals(LocalDate.parse("2026-12-11"), RecurringDates.generate(a,1,1).single())
    }
    @Test fun monthEndKeepsAnchor() {
        assertEquals(listOf("2027-02-28","2027-03-31"), RecurringDates.generate(LocalDate.parse("2027-01-31"),2,2).map { it.toString() })
    }
    @Test(expected=IllegalArgumentException::class) fun rejectsExcessiveCount() { RecurringDates.generate(LocalDate.now(),0,13) }
}

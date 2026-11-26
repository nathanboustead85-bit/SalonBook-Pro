package com.salonbook.pro

import java.time.LocalDate
import java.time.Instant
import org.junit.Test
import org.junit.Assert.*

class ReportingPeriodPreviewTest {
    private val day=ReportingPeriodPreview.Period.DAY
    private fun date(s:String)=LocalDate.parse(s)
    @Test fun daylightSaving() {
        val spring=ReportingPeriodPreview.ranges(date("2026-03-29"),day)!!
        val autumn=ReportingPeriodPreview.ranges(date("2026-10-25"),day)!!
        assertEquals(23L*3600000,spring.current.until-spring.current.from)
        assertEquals(25L*3600000,autumn.current.until-autumn.current.from)
        assertEquals(spring.current.from,spring.previous.until)
    }
    @Test fun calendarPeriods() {
        val week=ReportingPeriodPreview.ranges(date("2026-11-26"),ReportingPeriodPreview.Period.WEEK)!!
        assertEquals(Instant.parse("2026-11-23T00:00:00Z").toEpochMilli(),week.current.from)
        val month=ReportingPeriodPreview.ranges(date("2024-03-15"),ReportingPeriodPreview.Period.MONTH,"UTC")!!
        assertEquals(29L*86400000,month.previous.until-month.previous.from)
        val year=ReportingPeriodPreview.ranges(date("2024-06-01"),ReportingPeriodPreview.Period.YEAR,"UTC")!!
        assertEquals(366L*86400000,year.current.until-year.current.from)
        val custom=ReportingPeriodPreview.ranges(date("2026-11-01"),ReportingPeriodPreview.Period.CUSTOM,"UTC",date("2026-11-03"))!!
        assertEquals(3L*86400000,custom.current.until-custom.current.from)
        assertEquals(custom.current.from,custom.previous.until)
        assertNull(ReportingPeriodPreview.ranges(date("2026-11-01"),ReportingPeriodPreview.Period.CUSTOM,"UTC",date("2026-10-31")))
        assertNull(ReportingPeriodPreview.ranges(date("2026-11-01"),day,"invalid-zone"))
    }
    @Test fun growth() {
        assertEquals("25.00",ReportingPeriodPreview.growthPercent(125,100).toString())
        assertEquals("-100.00",ReportingPeriodPreview.growthPercent(0,100).toString())
        assertEquals("33.33",ReportingPeriodPreview.growthPercent(4,3).toString())
        assertNull(ReportingPeriodPreview.growthPercent(100,0))
        assertNull(ReportingPeriodPreview.growthPercent(-1,100))
        assertNotNull(ReportingPeriodPreview.growthPercent(Long.MAX_VALUE,1))
    }
}

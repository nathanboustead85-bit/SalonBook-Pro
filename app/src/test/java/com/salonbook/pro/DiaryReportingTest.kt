package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
class DiaryReportingTest {
    private val entries = listOf(DiaryReporting.Entry("2026-11-26","£20.50","a"),DiaryReporting.Entry("2026-11-23","10",""),DiaryReporting.Entry("2026-11-01","invalid","a"),DiaryReporting.Entry("2026-01-01","5","a"),DiaryReporting.Entry("2025-12-31","99","a"))
    @Test fun periods() {
        assertEquals(listOf(1,2,3,4),(0..3).map { DiaryReporting.summarise(entries,"2026-11-26",it).count })
        val s=DiaryReporting.summarise(entries,"2026-11-26",2)
        assertEquals("30.50",s.total.toPlainString())
        assertEquals(1,s.unknown)
        assertEquals(1,s.unassigned)
    }
    @Test fun invalidPrices() {
        val s=DiaryReporting.summarise(listOf(DiaryReporting.Entry("2026-11-26","-1",""),DiaryReporting.Entry("2026-11-26","1.999","")),"2026-11-26",0)
        assertEquals(2,s.unknown)
        assertEquals(0,s.total.signum())
    }
}

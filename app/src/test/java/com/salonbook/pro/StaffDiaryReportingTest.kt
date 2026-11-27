package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
class StaffDiaryReportingTest {
 @Test fun staffGroupsRespectPeriodAndUnknownPrices() {
  val rows = listOf(DiaryReporting.Entry("2026-11-27","20.50","a"), DiaryReporting.Entry("2026-11-27","bad","a"), DiaryReporting.Entry("2026-11-27","10",""), DiaryReporting.Entry("2026-10-01","100","b"))
  val result = DiaryReporting.byStaff(rows,"2026-11-27",0)
  assertEquals(listOf("a",""),result.map { it.staffId })
  assertEquals(2,result[0].summary.count)
  assertEquals("20.50",result[0].summary.total.toPlainString())
  assertEquals(1,result[0].summary.unknown)
  assertEquals(1,result[1].summary.unassigned)
 }
 @Test fun emptyPeriodHasNoStaffRows() {
  assertTrue(DiaryReporting.byStaff(emptyList(),"2026-11-27",0).isEmpty())
 }
}

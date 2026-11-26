package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
@RunWith(RobolectricTestRunner::class)
class RecoveredAvailabilityTest {
    private val services = """[{"id":"s","duration":30}]"""
    private val staff = """[{"id":"a","serviceIds":["s"],"weeklySchedule":{"thursday":{"open":"09:00","close":"17:00"}},"weeklyBreaks":[{"day":"thursday","start":"12:00","end":"13:00"}],"timeOff":[{"date":"2026-12-03","start":"00:00","end":"24:00"}]}]"""
    private fun check(date:String="2026-11-26", time:String="10:00", bookings:String="[]", exclude:String="") = AvailabilityEngine.checkAvailability(date,time,"a","s",services,staff,bookings,exclude).available
    @Test fun normalSlot() { assertTrue(check()) }
    @Test fun nonWorkingDay() { assertFalse(check(date="2026-11-27")) }
    @Test fun breakOverlap() { assertFalse(check(time="11:45")); assertTrue(check(time="13:00")) }
    @Test fun holiday() { assertFalse(check(date="2026-12-03")) }
    @Test fun closingBoundary() { assertTrue(check(time="16:30")); assertFalse(check(time="16:45")) }
    @Test fun editExclusion() { val b="""[{"id":"b","staffId":"a","date":"2026-11-26","time":"10:00","duration":30}]"""; assertFalse(check(bookings=b)); assertTrue(check(bookings=b,exclude="b")) }
}

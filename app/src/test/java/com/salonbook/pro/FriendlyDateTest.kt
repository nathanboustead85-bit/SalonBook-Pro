package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.assertEquals
class FriendlyDateTest {
    @Test fun readableDate() { assertEquals("Thursday, 26 Nov 2026", FriendlyDate.format("2026-11-26")) }
    @Test fun monthBoundary() { assertEquals("2026-12-01", FriendlyDate.shift("2026-11-30", 1)) }
    @Test fun yearBoundary() { assertEquals("2025-12-31", FriendlyDate.shift("2026-01-01", -1)) }
    @Test fun leapDay() { assertEquals("2028-02-29", FriendlyDate.shift("2028-02-28", 1)) }
    @Test fun invalidDateUnchanged() { assertEquals("2026-02-30", FriendlyDate.format("2026-02-30")); assertEquals("2026-02-30", FriendlyDate.shift("2026-02-30", 1)) }
}

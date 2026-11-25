package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class AutomaticReminderPlanTest {
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true, reminder2HoursEnabled = true)
    private val appointment = 200000000L
    @Test fun orderedWindows() {
        val windows = AutomaticReminderPlan.windows(appointment, 1L, settings)
        assertEquals(listOf(113600000L, 192800000L), windows.map { it.dueAtMillis })
        assertEquals(listOf(NotificationPreferences.ReminderType.HOURS_24, NotificationPreferences.ReminderType.HOURS_2), windows.map { it.type })
    }
    @Test fun defaultsAndDisabledMasterProduceNothing() {
        assertTrue(AutomaticReminderPlan.windows(appointment, 1L, NotificationPreferences.BusinessSettings()).isEmpty())
        assertTrue(AutomaticReminderPlan.windows(appointment, 1L, settings.copy(emailRemindersEnabled = false)).isEmpty())
    }
    @Test fun missedWindowsAreNotReplayed() {
        assertEquals(1, AutomaticReminderPlan.windows(appointment, 113600001L, settings).size)
        assertTrue(AutomaticReminderPlan.windows(appointment, 192800001L, settings).isEmpty())
        assertEquals(2, AutomaticReminderPlan.windows(appointment, 113600000L, settings).size)
    }
    @Test fun invalidAndExtremeTimes() {
        assertTrue(AutomaticReminderPlan.windows(appointment, appointment, settings).isEmpty())
        assertTrue(AutomaticReminderPlan.windows(appointment, -1L, settings).isEmpty())
        assertTrue(AutomaticReminderPlan.windows(Long.MIN_VALUE, 1L, settings).isEmpty())
        assertEquals(2, AutomaticReminderPlan.windows(Long.MAX_VALUE, 1L, settings).size)
    }
}

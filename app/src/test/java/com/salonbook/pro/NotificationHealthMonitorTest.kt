package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationHealthMonitorTest {
    @get:Rule val folder = TemporaryFolder()
    @Test fun transitionsOnly() {
        val monitor = NotificationHealthMonitor()
        val fault = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
        assertEquals(NotificationHealthMonitor.Signal.DEGRADED, monitor.record(fault))
        assertEquals(NotificationHealthMonitor.Signal.NONE, monitor.record(fault))
        assertEquals(NotificationHealthMonitor.Signal.CRITICAL, monitor.record(fault))
        repeat(100) { assertEquals(NotificationHealthMonitor.Signal.NONE, monitor.record(fault)) }
        assertEquals(NotificationHealthMonitor.Signal.NONE, monitor.record(PersistentReminderPreviewLedger.Result.REJECTED))
        assertEquals(NotificationHealthMonitor.State.CRITICAL, monitor.snapshot())
        assertEquals(NotificationHealthMonitor.Signal.RECOVERED, monitor.record(PersistentReminderPreviewLedger.Result.CLAIMED))
        assertEquals(NotificationHealthMonitor.State.HEALTHY, monitor.snapshot())
    }
    @Test fun integrationTracksRealStorageFaultWithoutExposingIt() {
        val dir = File(folder.root, "blocked")
        dir.writeText("blocked")
        val integration = NotificationPreviewIntegration(dir)
        val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "private@example.invalid", true, true)
        val consent = NotificationPreferences.CustomerConsent("customer", true, false, 100L)
        val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true)
        fun preview() = integration.preview(booking, booking, "owner", "owner", "customer", consent, settings, NotificationPreferences.ReminderType.HOURS_24, 2000L, 1000L)
        repeat(3) { assertEquals("notification_preview_rejected", preview()) }
        assertEquals(NotificationHealthMonitor.State.CRITICAL, integration.healthState())
        assertTrue(dir.delete())
        assertTrue(dir.mkdir())
        assertEquals("notification_preview_allowed", preview())
        assertEquals(NotificationHealthMonitor.State.HEALTHY, integration.healthState())
        repeat(5) { assertEquals("notification_preview_rejected", preview()) }
        assertEquals(NotificationHealthMonitor.State.HEALTHY, integration.healthState())
    }
}

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
class PersistentNotificationHealthTest {
    @get:Rule val folder = TemporaryFolder()
    private val fault = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
    private val success = PersistentReminderPreviewLedger.Result.CLAIMED
    @Test fun restartAndRecovery() {
        val dir = folder.root
        assertEquals(NotificationHealthMonitor.Signal.DEGRADED, NotificationHealthMonitor(dir).record(fault))
        assertEquals(NotificationHealthMonitor.State.DEGRADED, NotificationHealthMonitor(dir).snapshot())
        assertEquals(NotificationHealthMonitor.Signal.NONE, NotificationHealthMonitor(dir).record(fault))
        assertEquals(NotificationHealthMonitor.Signal.CRITICAL, NotificationHealthMonitor(dir).record(fault))
        assertEquals(NotificationHealthMonitor.Signal.NONE, NotificationHealthMonitor(dir).record(fault))
        assertEquals(NotificationHealthMonitor.Signal.RECOVERED, NotificationHealthMonitor(dir).record(success))
        assertEquals(NotificationHealthMonitor.State.HEALTHY, NotificationHealthMonitor(dir).snapshot())
    }
    @Test fun corruptStateIsNeverHealthy() {
        val dir = folder.root
        val file = File(dir, "notification-health-v1.state")
        file.writeText("BOUSTIO-HEALTH-1\n0\ninvalid")
        assertEquals(NotificationHealthMonitor.State.CRITICAL, NotificationHealthMonitor(dir).snapshot())
        assertEquals(NotificationHealthMonitor.Signal.RECOVERED, NotificationHealthMonitor(dir).record(success))
        assertEquals(NotificationHealthMonitor.State.HEALTHY, NotificationHealthMonitor(dir).snapshot())
    }
    @Test fun interruptedWritePreservesCommittedState() {
        val dir = folder.root
        NotificationHealthMonitor(dir).record(fault)
        File(dir, "notification-health-v1.state.new").writeText("partial")
        assertEquals(NotificationHealthMonitor.State.DEGRADED, NotificationHealthMonitor(dir).snapshot())
    }
    @Test fun unavailableStorageRecovers() {
        val dir = File(folder.root, "blocked")
        dir.writeText("blocked")
        val monitor = NotificationHealthMonitor(dir)
        monitor.record(fault)
        assertEquals(NotificationHealthMonitor.State.CRITICAL, monitor.snapshot())
        assertTrue(dir.delete())
        assertTrue(dir.mkdir())
        assertEquals(NotificationHealthMonitor.Signal.RECOVERED, monitor.record(success))
        assertEquals(NotificationHealthMonitor.State.HEALTHY, NotificationHealthMonitor(dir).snapshot())
    }
}

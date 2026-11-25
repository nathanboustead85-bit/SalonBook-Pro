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
class NotificationRecoveryIsolationTest {
    @get:Rule val folder = TemporaryFolder()
    @Test fun clockFailureDoesNotExecuteOperation() {
        val gate = NotificationRetryGate(folder.root) { error("clock unavailable") }
        var called = false
        assertNull(gate.attemptMonotonic { called = true; PersistentReminderPreviewLedger.Result.CLAIMED })
        assertFalse(called)
    }
    @Test fun unavailableRetryStorageDoesNotTouchUnrelatedFile() {
        val unrelated = File(folder.root, "unrelated-sentinel").apply { writeText("unchanged") }
        File(folder.root, "notification-retry-v1.state").mkdir()
        val gate = NotificationRetryGate(folder.root)
        var called = false
        assertNull(gate.attemptInEpoch(0, "epoch") { called = true; PersistentReminderPreviewLedger.Result.CLAIMED })
        assertFalse(called)
        assertEquals("unchanged", unrelated.readText())
    }
    @Test fun diagnosticStorageFaultContainsRepeatedAttempts() {
        File(folder.root, "notification-recovery-v1.state").mkdir()
        val gate = NotificationRetryGate(folder.root)
        val failure = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
        assertEquals(failure, gate.attemptInEpoch(0, "epoch") { failure })
        assertEquals(NotificationRecoveryDiagnostics.Severity.CRITICAL, gate.recoveryState().severity)
        assertNull(gate.attemptInEpoch(3599999, "epoch") { error("blocked") })
        assertEquals(failure, gate.attemptInEpoch(3600000, "epoch") { failure })
    }
}

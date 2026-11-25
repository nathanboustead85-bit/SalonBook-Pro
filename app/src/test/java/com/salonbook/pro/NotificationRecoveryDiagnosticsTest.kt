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
class NotificationRecoveryDiagnosticsTest {
    @get:Rule val folder = TemporaryFolder()
    @Test fun persistsAndBoundsRepeatedFailures() {
        val d = NotificationRecoveryDiagnostics(folder.root)
        repeat(105) { d.record(NotificationRecoveryDiagnostics.Event.STORAGE_FAILURE) }
        val restored = NotificationRecoveryDiagnostics(folder.root)
        assertEquals(100, restored.snapshot().failures)
        assertEquals(NotificationRecoveryDiagnostics.Severity.CRITICAL, restored.snapshot().severity)
        restored.record(NotificationRecoveryDiagnostics.Event.RECOVERED)
        assertEquals(NotificationRecoveryDiagnostics.Severity.HEALTHY, d.snapshot().severity)
    }
    @Test fun corruptRecordIsCritical() {
        File(folder.root, "notification-recovery-v1.state").writeText("invalid")
        assertEquals(NotificationRecoveryDiagnostics.Severity.CRITICAL, NotificationRecoveryDiagnostics(folder.root).snapshot().severity)
    }
    @Test fun retryFailuresAndRestartAreRecorded() {
        val gate = NotificationRetryGate(folder.root)
        val fault = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
        assertEquals(fault, gate.attemptInEpoch(0, "first") { fault })
        assertEquals(fault, gate.attemptInEpoch(30000, "first") { fault })
        assertEquals(fault, gate.attemptInEpoch(150000, "first") { fault })
        assertEquals(3, gate.recoveryState().failures)
        assertNull(gate.attemptInEpoch(100, "second") { error("blocked") })
        assertEquals(1, gate.recoveryState().stalls)
        assertNull(gate.attemptInEpoch(101, "second") { error("blocked") })
        assertEquals(1, gate.recoveryState().stalls)
        assertEquals(PersistentReminderPreviewLedger.Result.CLAIMED, gate.attemptInEpoch(3600100, "second") { PersistentReminderPreviewLedger.Result.CLAIMED })
        assertEquals(NotificationRecoveryDiagnostics.Severity.HEALTHY, gate.recoveryState().severity)
    }
}

package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationRecoveryEscalationTest {
    @get:Rule val folder = TemporaryFolder()
    @Test fun transitionsSuppressRepeatedSignalsAcrossInstances() {
        val event = NotificationRecoveryDiagnostics.Event.STORAGE_FAILURE
        val d = NotificationRecoveryDiagnostics(folder.root)
        assertEquals(NotificationRecoveryDiagnostics.Signal.WARNING, d.record(event))
        assertEquals(NotificationRecoveryDiagnostics.Signal.NONE, d.record(event))
        val restored = NotificationRecoveryDiagnostics(folder.root)
        assertEquals(NotificationRecoveryDiagnostics.Signal.CRITICAL, restored.record(event))
        assertEquals(NotificationRecoveryDiagnostics.Signal.NONE, d.record(event))
        assertEquals(NotificationRecoveryDiagnostics.Signal.RECOVERED, restored.record(NotificationRecoveryDiagnostics.Event.RECOVERED))
        assertEquals(NotificationRecoveryDiagnostics.Signal.NONE, d.record(NotificationRecoveryDiagnostics.Event.RECOVERED))
    }
    @Test fun criticalProbeReservesFullCooldown() {
        val gate = NotificationRetryGate(folder.root)
        val fault = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
        gate.attemptInEpoch(0, "epoch") { fault }
        gate.attemptInEpoch(30000, "epoch") { fault }
        gate.attemptInEpoch(150000, "epoch") { fault }
        assertEquals(fault, gate.attemptInEpoch(750000, "epoch") { fault })
        assertNull(gate.attemptInEpoch(4349999, "epoch") { error("blocked") })
        assertEquals(PersistentReminderPreviewLedger.Result.CLAIMED, gate.attemptInEpoch(4350000, "epoch") { PersistentReminderPreviewLedger.Result.CLAIMED })
        assertEquals(NotificationRecoveryDiagnostics.Severity.HEALTHY, gate.recoveryState().severity)
    }
}

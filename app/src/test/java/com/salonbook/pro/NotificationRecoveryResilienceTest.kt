package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationRecoveryResilienceTest {
    @get:Rule val folder = TemporaryFolder()
    @Test fun simultaneousFailuresReserveOnlyOneAttempt() {
        val pool = Executors.newFixedThreadPool(8)
        val calls = AtomicInteger()
        try {
            val tasks = (1..64).map {
                pool.submit {
                    NotificationRetryGate(folder.root).attemptInEpoch(1000, "epoch") {
                        calls.incrementAndGet()
                        PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
                    }
                }
            }
            tasks.forEach { it.get(20, TimeUnit.SECONDS) }
            assertEquals(1, calls.get())
            assertEquals(1, NotificationRetryGate(folder.root).recoveryState().failures)
        } finally { pool.shutdownNow() }
    }
    @Test fun interruptionPreservesReservationAndInterruptFlag() {
        val gate = NotificationRetryGate(folder.root)
        try {
            assertNull(gate.attemptInEpoch(1000, "epoch") { throw InterruptedException() })
            assertTrue(Thread.currentThread().isInterrupted)
        } finally { Thread.interrupted() }
        val restored = NotificationRetryGate(folder.root)
        assertNull(restored.attemptInEpoch(30999, "epoch") { error("blocked") })
        assertEquals(PersistentReminderPreviewLedger.Result.CLAIMED, restored.attemptInEpoch(31000, "epoch") { PersistentReminderPreviewLedger.Result.CLAIMED })
        assertEquals(NotificationRecoveryDiagnostics.Severity.HEALTHY, restored.recoveryState().severity)
    }
    @Test fun orphanedReservationAndCorruptDiagnosticsFailClosed() {
        File(folder.root, "notification-retry-v1.state.new").writeText("partial")
        File(folder.root, "notification-recovery-v1.state").writeText("corrupt")
        val gate = NotificationRetryGate(folder.root)
        assertNull(gate.attemptInEpoch(1000, "epoch") { error("blocked") })
        assertEquals(NotificationRecoveryDiagnostics.Severity.CRITICAL, gate.recoveryState().severity)
        assertNull(NotificationRetryGate(folder.root).attemptInEpoch(3600999, "epoch") { error("blocked") })
    }
}

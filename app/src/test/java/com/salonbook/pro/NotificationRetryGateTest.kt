package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationRetryGateTest {
    @get:Rule val folder = TemporaryFolder()
    private val fault = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
    private val success = PersistentReminderPreviewLedger.Result.CLAIMED
    @Test fun persistentProgressiveDelayAndCooldown() {
        fun attempt(t: Long) = NotificationRetryGate(folder.root).attempt(t) { fault }
        assertEquals(fault, attempt(0))
        assertNull(attempt(29999))
        assertEquals(fault, attempt(30000))
        assertNull(attempt(149999))
        assertEquals(fault, attempt(150000))
        assertNull(attempt(749999))
        assertEquals(fault, attempt(750000))
        assertNull(attempt(4349999))
        assertEquals(success, NotificationRetryGate(folder.root).attempt(4350000) { success })
        assertEquals(success, NotificationRetryGate(folder.root).attempt(4350000) { success })
    }
    @Test fun concurrentFailuresReserveOnlyOneAttempt() {
        val pool = Executors.newFixedThreadPool(4)
        try {
            val tasks = (1..12).map { pool.submit<Boolean> {
                NotificationRetryGate(folder.root).attempt(1000) { fault } != null
            } }
            assertEquals(1, tasks.count { it.get(10, TimeUnit.SECONDS) })
        } finally { pool.shutdownNow() }
    }
    @Test fun corruptStateBlocksExecution() {
        File(folder.root, "notification-retry-v1.state").writeText("invalid")
        assertNull(NotificationRetryGate(folder.root).attempt(1000) { error("must not execute") })
        assertNull(NotificationRetryGate(folder.root).attempt(3600999) { success })
        assertEquals(success, NotificationRetryGate(folder.root).attempt(3601000) { success })
    }
    @Test fun backwardClockJumpRebasesToBoundedCooldown() {
        assertEquals(fault, NotificationRetryGate(folder.root).attempt(10_000_000) { fault })
        assertNull(NotificationRetryGate(folder.root).attempt(1000) { success })
        assertNull(NotificationRetryGate(folder.root).attempt(3600999) { success })
        assertEquals(success, NotificationRetryGate(folder.root).attempt(3601000) { success })
    }
    @Test fun orphanedPendingWriteRecoversConservatively() {
        File(folder.root, "notification-retry-v1.state.new").writeText("partial")
        assertNull(NotificationRetryGate(folder.root).attempt(1000) { success })
        assertEquals(success, NotificationRetryGate(folder.root).attempt(3601000) { success })
    }
    @Test fun newProcessEpochRequiresFreshCooldown() {
        assertEquals(fault, NotificationRetryGate(folder.root).attemptInEpoch(1000, "first") { fault })
        assertNull(NotificationRetryGate(folder.root).attemptInEpoch(9999999, "second") { error("blocked") })
        assertNull(NotificationRetryGate(folder.root).attemptInEpoch(13599998, "second") { error("blocked") })
        assertEquals(success, NotificationRetryGate(folder.root).attemptInEpoch(13599999, "second") { success })
    }
    @Test fun monotonicTimingIgnoresWallClock() {
        var elapsed = 1000L
        val gate = NotificationRetryGate(folder.root) { elapsed }
        assertEquals(fault, gate.attemptMonotonic() { fault })
        android.os.SystemClock.setCurrentTimeMillis(9000000000000L)
        assertNull(gate.attemptMonotonic() { error("blocked") })
        android.os.SystemClock.setCurrentTimeMillis(1000L)
        elapsed = 30999L
        assertNull(gate.attemptMonotonic() { error("blocked") })
        elapsed = 31000L
        assertEquals(success, gate.attemptMonotonic() { success })
    }
    @Test fun interruptedReservationSurvivesRestart() {
        val gate = NotificationRetryGate(folder.root)
        assertEquals(fault, gate.attempt(1000) { throw IllegalStateException() })
        assertNull(NotificationRetryGate(folder.root).attempt(30999) { success })
        assertEquals(success, NotificationRetryGate(folder.root).attempt(31000) { success })
    }
}

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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NotificationResilienceTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "test@example.invalid", true, true)
    private fun claim(directory: File = folder.root, event: String = "reminder-24h", snapshot: NotificationSafetyPolicy.BookingSnapshot = booking) =
        PersistentReminderPreviewLedger(directory).claim(snapshot, snapshot, "owner", event, true)

    @Test fun simultaneousDuplicateClaimsAllowExactlyOne() {
        val pool = Executors.newFixedThreadPool(8)
        val start = CountDownLatch(1)
        try {
            val tasks = (1..16).map { pool.submit<Boolean> { start.await(); claim() } }
            start.countDown()
            assertEquals(1, tasks.count { it.get(20, TimeUnit.SECONDS) })
            assertFalse(claim())
        } finally { pool.shutdownNow() }
    }
    @Test fun simultaneousDistinctClaimsSurviveRestart() {
        val pool = Executors.newFixedThreadPool(4)
        try {
            val snapshots = (1..8).map { booking.copy(bookingId = "booking-$it") }
            val tasks = snapshots.map { snapshot -> pool.submit<Boolean> { claim(snapshot = snapshot) } }
            assertTrue(tasks.all { it.get(20, TimeUnit.SECONDS) })
            snapshots.forEach { assertFalse(claim(snapshot = it)) }
        } finally { pool.shutdownNow() }
    }
    @Test fun interruptedReplacementPreservesCommittedHistory() {
        assertTrue(claim())
        val base = File(folder.root, "reminder-preview-v1.history")
        File(base.path + ".new").writeText("partial")
        assertFalse(claim())
        assertTrue(claim(event = "reminder-2h"))
        assertFalse(claim(event = "reminder-2h"))
    }
    @Test fun legacyBackupRecoversCommittedHistory() {
        assertTrue(claim())
        val base = File(folder.root, "reminder-preview-v1.history")
        assertTrue(base.renameTo(File(base.path + ".bak")))
        base.writeText("partial")
        assertFalse(claim())
        assertTrue(claim(event = "reminder-2h"))
    }
    @Test fun unavailableStorageRejectsThenRecovers() {
        val directory = File(folder.root, "blocked")
        directory.writeText("not a directory")
        assertFalse(claim(directory))
        assertEquals("not a directory", directory.readText())
        assertTrue(directory.delete())
        assertTrue(directory.mkdir())
        assertTrue(claim(directory))
        assertFalse(claim(directory))
    }
    @Test fun oversizedBackupFailsClosed() {
        val backup = File(folder.root, "reminder-preview-v1.history.bak")
        backup.writeBytes(ByteArray(700001))
        assertFalse(claim())
        assertEquals(700001L, backup.length())
    }
}

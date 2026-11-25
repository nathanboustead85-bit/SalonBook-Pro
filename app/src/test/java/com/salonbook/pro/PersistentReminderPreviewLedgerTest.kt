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
class PersistentReminderPreviewLedgerTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("business", "booking", 1L, true, false, "test@example.invalid", true, true)
    private fun claim(event: String = "reminder-24h", eligible: Boolean = true) =
        PersistentReminderPreviewLedger(folder.root).claim(booking, booking, "business", event, eligible)
    @Test fun survivesNewInstance() { assertTrue(claim()); assertFalse(claim()); assertTrue(claim("reminder-2h")) }
    @Test fun corruptHistoryFailsClosed() {
        val history = File(folder.root, "reminder-preview-v1.history")
        history.writeText("broken")
        assertFalse(claim()); assertEquals("broken", history.readText())
    }
    @Test fun interruptedFirstWriteFailsClosed() {
        File(folder.root, "reminder-preview-v1.history.new").writeText("partial")
        assertFalse(claim())
    }
    @Test fun rejectedClaimDoesNotWrite() {
        assertFalse(claim(eligible = false))
        assertFalse(File(folder.root, "reminder-preview-v1.history").exists())
        assertTrue(claim())
    }
    @Test fun liveDeliveryDisabled() { assertFalse(NotificationSafetyPolicy.mayQueueEmail(booking, "business")) }
}

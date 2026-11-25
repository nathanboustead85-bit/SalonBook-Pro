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
class NotificationIntegrationAuditTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "private@example.invalid", true, true)
    private val consent = NotificationPreferences.CustomerConsent("customer", true, false, 100L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true, reminder24HoursEnabled = true)
    private fun preview(owner: String = "owner", current: NotificationSafetyPolicy.BookingSnapshot = booking) =
        NotificationPreviewIntegration(folder.root).preview(booking, current, owner, owner, "customer", consent, settings, NotificationPreferences.ReminderType.HOURS_24, 2000L, 1000L)
    @Test fun concurrentAuthorizedAndUnauthorizedRequestsAllowExactlyOne() {
        val pool = Executors.newFixedThreadPool(8)
        try {
            val tasks = (0 until 64).map { i -> pool.submit<String> { preview(if (i % 2 == 0) "owner" else "other") } }
            val results = tasks.map { it.get(20, TimeUnit.SECONDS) }
            assertEquals(1, results.count { it == "notification_preview_allowed" })
            assertTrue(results.filterIndexed { i, _ -> i % 2 == 1 }.all { it == "notification_preview_rejected" })
            assertEquals("notification_preview_rejected", preview())
        } finally { pool.shutdownNow() }
    }
    @Test fun unauthorizedRequestsDoNotMutateRecoveryOrHistory() {
        val sentinel = File(folder.root, "unrelated-record").apply { writeText("unchanged") }
        assertEquals("notification_preview_rejected", preview("other"))
        assertEquals("notification_preview_rejected", preview(current = booking.copy(revision = 2L)))
        assertEquals(setOf("unrelated-record"), folder.root.list()!!.toSet())
        assertEquals("unchanged", sentinel.readText())
    }
    @Test fun corruptedLedgerAndRetryStateRemainFailClosed() {
        val ledger = File(folder.root, "reminder-preview-v1.history").apply { writeText("corrupt") }
        File(folder.root, "notification-retry-v1.state").writeText("corrupt")
        repeat(8) { assertEquals("notification_preview_rejected", preview()) }
        assertEquals("corrupt", ledger.readText())
        assertFalse(NotificationSafetyPolicy.LIVE_EMAIL_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_WHATSAPP_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_BOOKING_ENABLED)
    }
}

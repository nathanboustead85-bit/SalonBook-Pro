package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*
import java.util.concurrent.Executors
import java.util.concurrent.Callable

class ReminderPreviewLedgerTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("business", "booking", 1L, true, false, "test@example.invalid", true, true)
    private val ledger = ReminderPreviewLedger()
    private fun claim(candidate: NotificationSafetyPolicy.BookingSnapshot? = booking, current: NotificationSafetyPolicy.BookingSnapshot? = booking, owner: String = "business", event: String = "reminder-24h", eligible: Boolean = true) =
        ledger.claimPreview(candidate, current, owner, event, eligible)

    @Test fun duplicatesAndDistinctEvents() {
        assertTrue(claim()); assertFalse(claim()); assertTrue(claim(event = "reminder-2h")); assertFalse(claim(event = "reminder-2h"))
    }
    @Test fun staleRevisionAndCancellation() {
        val newer = booking.copy(revision = 2L)
        assertFalse(claim(current = newer))
        assertTrue(claim(candidate = newer, current = newer))
        val canceled = newer.copy(canceled = true)
        assertFalse(claim(candidate = canceled, current = canceled))
    }
    @Test fun rejectedPreviewDoesNotConsumeKey() {
        assertFalse(claim(eligible = false)); assertFalse(claim(owner = "other"))
        assertFalse(claim(current = null)); assertFalse(claim(event = "invalid"))
        assertFalse(claim(current = booking.copy(emailConsent = false)))
        assertTrue(claim())
    }
    @Test fun concurrentDuplicates() {
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { claim() } })
            assertEquals(1, results.count { it.get() })
        } finally { pool.shutdownNow() }
    }
    @Test fun liveDeliveryRemainsDisabled() {
        assertFalse(NotificationSafetyPolicy.mayQueueEmail(booking, "business"))
        assertFalse(NotificationSafetyPolicy.LIVE_WHATSAPP_ENABLED)
        assertFalse(NotificationSafetyPolicy.LIVE_BOOKING_ENABLED)
    }
}

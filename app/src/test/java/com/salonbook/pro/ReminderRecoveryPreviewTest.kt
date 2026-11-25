package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ReminderRecoveryPreviewTest {
    private val due = 1000000L
    private val failure = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
    private val success = PersistentReminderPreviewLedger.Result.CLAIMED
    @Test fun temporaryFailureRecovers() {
        val gate = ReminderRecoveryPreview(due)
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,gate.attempt(due) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,gate.attempt(due+29999) { error("early") })
        assertEquals(ReminderRecoveryPreview.Outcome.CLAIMED,gate.attempt(due+30000) { success })
        assertEquals(ReminderRecoveryPreview.Outcome.CLAIMED,gate.attempt(due+30001) { fail("duplicate"); failure })
    }
    @Test fun boundedFailuresAndExpiry() {
        val gate = ReminderRecoveryPreview(due)
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,gate.attempt(due) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,gate.attempt(due+30000) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.EXHAUSTED,gate.attempt(due+150000) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.EXHAUSTED,gate.attempt(due+150001) { fail("extra retry"); failure })
        assertEquals(ReminderRecoveryPreview.Outcome.EXPIRED,ReminderRecoveryPreview(due).attempt(due+300001) { fail("expired"); failure })
    }
    @Test fun ambiguousFailureAndClockRollbackStop() {
        val gate = ReminderRecoveryPreview(due)
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,gate.attempt(due) { error("unknown") })
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,gate.attempt(due+30000) { fail("unsafe retry"); failure })
        val second = ReminderRecoveryPreview(due)
        second.attempt(due) { failure }
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,second.attempt(due-1) { success })
    }
    @Test fun concurrentAttemptsExecuteOnce() {
        val gate = ReminderRecoveryPreview(due)
        val count = java.util.concurrent.atomic.AtomicInteger()
        val pool = Executors.newFixedThreadPool(8)
        try {
            (1..64).map { pool.submit<ReminderRecoveryPreview.Outcome> { gate.attempt(due) { count.incrementAndGet(); success } } }.forEach { it.get(20,TimeUnit.SECONDS) }
            assertEquals(1,count.get())
        } finally { pool.shutdownNow() }
    }
}

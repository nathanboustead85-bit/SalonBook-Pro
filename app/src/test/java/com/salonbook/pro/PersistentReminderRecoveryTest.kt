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
class PersistentReminderRecoveryTest {
    @get:Rule val folder = TemporaryFolder()
    private val due = 1000000L
    private val event = ReminderSchedulePreview.Event("a".repeat(64),AutomaticReminderPlan.Window(NotificationPreferences.ReminderType.HOURS_24,due))
    private val failure = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
    private val success = PersistentReminderPreviewLedger.Result.CLAIMED
    private fun attempt(now: Long, op: () -> PersistentReminderPreviewLedger.Result) = PersistentReminderRecovery(folder.root).attempt(event,now,op)
    @Test fun exhaustionSurvivesRestart() {
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,attempt(due) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,attempt(due+29999) { fail("early"); failure })
        assertEquals(ReminderRecoveryPreview.Outcome.WAIT,attempt(due+30000) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.EXHAUSTED,attempt(due+150000) { failure })
        assertEquals(ReminderRecoveryPreview.Outcome.EXHAUSTED,attempt(due+150001) { fail("extra"); success })
    }
    @Test fun unknownReservationAndCorruptionBlock() {
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,attempt(due) { error("interrupted") })
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,attempt(due+30000) { fail("unsafe"); success })
        val file = File(folder.root,"reminder-retry-${event.id}.state")
        file.writeText("corrupt")
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,attempt(due+30000) { fail("corrupt"); success })
        assertEquals("corrupt",file.readText())
    }
    @Test fun concurrentInstancesOnlyOneOperation() {
        val count = java.util.concurrent.atomic.AtomicInteger()
        val pool = Executors.newFixedThreadPool(8)
        try {
            (1..32).map { pool.submit<ReminderRecoveryPreview.Outcome> { attempt(due) { count.incrementAndGet(); success } } }.forEach { assertEquals(ReminderRecoveryPreview.Outcome.CLAIMED,it.get(20,TimeUnit.SECONDS)) }
            assertEquals(1,count.get())
        } finally { pool.shutdownNow() }
    }
    @Test fun orphanedWriteAndExpiryBlock() {
        val pending = File(folder.root,"reminder-retry-${event.id}.state.new")
        pending.writeText("partial")
        assertEquals(ReminderRecoveryPreview.Outcome.UNKNOWN,attempt(due) { fail("orphan"); success })
        pending.delete()
        assertEquals(ReminderRecoveryPreview.Outcome.EXPIRED,attempt(due+300001) { fail("expired"); success })
        assertEquals(ReminderRecoveryPreview.Outcome.EXPIRED,attempt(due) { fail("rollback"); success })
    }
}

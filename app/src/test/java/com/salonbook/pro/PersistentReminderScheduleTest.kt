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
class PersistentReminderScheduleTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner", "booking", 1L, true, false, "private@example.invalid", true, true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",200000000L)
    private val consent = NotificationPreferences.CustomerConsent("customer",true,false,100L)
    private val settings = NotificationPreferences.BusinessSettings(emailRemindersEnabled = true,reminder24HoursEnabled = true,reminder2HoursEnabled = true)
    private fun apply(s: SecureReminderPlan.Snapshot = snapshot) = ReminderSchedulePreview(folder.root).reconcile(s,s,"owner","owner",consent,settings,1000L)
    @Test fun restartAndCancellationTombstone() {
        val first = apply()
        assertEquals(2,first.size)
        assertEquals(first,apply())
        assertEquals(2,ReminderSchedulePreview(folder.root).count())
        assertTrue(apply(snapshot.copy(booking = booking.copy(revision = 2L,canceled = true))).isEmpty())
        assertTrue(apply().isEmpty())
        assertEquals(0,ReminderSchedulePreview(folder.root).count())
    }
    @Test fun corruptAndOrphanedStorageFailClosed() {
        val file = File(folder.root,"reminder-schedule-v1.state")
        val pending = File(file.path+".new")
        pending.writeText("interrupted")
        assertTrue(apply().isEmpty())
        assertFalse(file.exists())
        pending.delete()
        file.writeText("corrupt")
        assertTrue(apply().isEmpty())
        assertEquals("corrupt",file.readText())
    }
    @Test fun concurrentInstancesAndPrivateStorage() {
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = (1..32).map { pool.submit<List<ReminderSchedulePreview.Event>> { apply() } }.map { it.get(20,TimeUnit.SECONDS) }
            assertEquals(2,results.first().size)
            assertEquals(1,results.distinct().size)
            assertEquals(2,ReminderSchedulePreview(folder.root).count())
            val data = File(folder.root,"reminder-schedule-v1.state").readText()
            assertFalse(data.contains("private@example.invalid"))
            assertFalse(data.contains("customer"))
        } finally { pool.shutdownNow() }
    }
    @Test fun committedBackupRecovers() {
        val first = apply()
        assertEquals(2,first.size)
        val file = File(folder.root,"reminder-schedule-v1.state")
        file.copyTo(File(file.path+".bak"))
        file.writeText("interrupted")
        assertEquals(first,apply())
    }
}

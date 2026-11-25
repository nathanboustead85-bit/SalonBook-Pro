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
import java.util.concurrent.Callable

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class CommunicationHistoryPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","private-booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"private-customer",1795622400000L)
    private val email = AppointmentCancellationPreview.Channel.EMAIL
    private val whatsapp = AppointmentCancellationPreview.Channel.WHATSAPP
    private val accepted = CommunicationHistoryPreview.Status.ACCEPTED
    @Test fun restartAndPrivacy() {
        val dir = folder.root
        val h = CommunicationHistoryPreview(dir)
        assertEquals(CommunicationHistoryPreview.Result.RECORDED,h.record(snapshot,"owner","owner",email,100,accepted))
        assertEquals(CommunicationHistoryPreview.Result.RECORDED,h.record(snapshot,"owner","owner",whatsapp,101,CommunicationHistoryPreview.Status.UNAVAILABLE))
        val reopened = CommunicationHistoryPreview(dir)
        assertEquals(100L,reopened.lookup(snapshot,"owner","owner",email)!!.timestamp)
        assertEquals(CommunicationHistoryPreview.Status.UNAVAILABLE,reopened.lookup(snapshot,"owner","owner",whatsapp)!!.status)
        assertEquals(CommunicationHistoryPreview.Result.DUPLICATE,reopened.record(snapshot,"owner","owner",email,200,accepted))
        assertNull(reopened.lookup(snapshot,"other","other",email))
        assertEquals(CommunicationHistoryPreview.Result.INVALID,reopened.record(snapshot,"other","other",email,200,accepted))
        val raw = File(dir,"communication-history-v1.state").readText()
        listOf("private-booking","private-customer","test@example.invalid","owner").forEach { assertFalse(raw.contains(it)) }
    }
    @Test fun concurrentAndCorruption() {
        val dir = folder.root
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { CommunicationHistoryPreview(dir).record(snapshot,"owner","owner",email,100,accepted) } }).map { it.get() }
            assertEquals(1,results.count { it == CommunicationHistoryPreview.Result.RECORDED })
            assertEquals(63,results.count { it == CommunicationHistoryPreview.Result.DUPLICATE })
        } finally { pool.shutdownNow() }
        File(dir,"communication-history-v1.state").writeText("corrupt")
        val h = CommunicationHistoryPreview(dir)
        assertNull(h.lookup(snapshot,"owner","owner",email))
        assertEquals(CommunicationHistoryPreview.Result.STORAGE_FAILURE,h.record(snapshot,"owner","owner",whatsapp,101,accepted))
    }
}

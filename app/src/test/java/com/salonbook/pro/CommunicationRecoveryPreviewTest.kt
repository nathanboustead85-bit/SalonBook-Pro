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
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class CommunicationRecoveryPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",1795622400000L)
    private val contact = CustomerCommunicationPolicy.Contact("customer","test@example.invalid","+447000000000")
    private val state = CommunicationPreferencesPreview.State("owner","customer",2,CommunicationPreferencesPreview.Choice(true,10),CommunicationPreferencesPreview.Choice(true,20))
    private val controls = CommunicationPreferencesPreview.Controls(true,true)
    private val email = AppointmentCancellationPreview.Channel.EMAIL
    private val whatsapp = AppointmentCancellationPreview.Channel.WHATSAPP
    private fun attempt(channel: AppointmentCancellationPreview.Channel, now: Long, current: CommunicationPreferencesPreview.State = state, operation: () -> CommunicationRecoveryPreview.Response) =
        CommunicationRecoveryPreview(folder.root).attempt(snapshot,"owner","owner",contact,current,current,controls,channel,now,operation)
    @Test fun retriesAndIndependentChannels() {
        val failure = CommunicationRecoveryPreview.Response.DEFINITELY_NOT_SUBMITTED
        assertEquals(CommunicationRecoveryPreview.Status.PENDING,attempt(email,100){failure})
        assertEquals(CommunicationRecoveryPreview.Status.WAIT,attempt(email,30099){error("too early")})
        assertEquals(CommunicationRecoveryPreview.Status.PROCESSED,attempt(whatsapp,101){CommunicationRecoveryPreview.Response.ACCEPTED})
        val withdrawn = state.copy(revision=3,email=CommunicationPreferencesPreview.Choice(false,200))
        assertEquals(CommunicationRecoveryPreview.Status.REJECTED,attempt(email,30100,withdrawn){error("withdrawn")})
        assertEquals(CommunicationRecoveryPreview.Status.PENDING,attempt(email,30100){failure})
        assertEquals(CommunicationRecoveryPreview.Status.WAIT,attempt(email,150099){error("too early")})
        assertEquals(CommunicationRecoveryPreview.Status.EXHAUSTED,attempt(email,150100){failure})
        assertEquals(CommunicationRecoveryPreview.Status.EXHAUSTED,attempt(email,300000){error("exhausted")})
        assertEquals(CommunicationRecoveryPreview.Status.PROCESSED,attempt(whatsapp,300000){error("duplicate")})
    }
    @Test fun unknownAndConcurrentAttempts() {
        val calls = AtomicInteger()
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { attempt(email,100){calls.incrementAndGet(); throw IllegalStateException("uncertain")} } }).map { it.get() }
            assertEquals(1,calls.get())
            assertTrue(results.all { it == CommunicationRecoveryPreview.Status.UNKNOWN })
        } finally { pool.shutdownNow() }
        assertEquals(CommunicationRecoveryPreview.Status.UNKNOWN,attempt(email,500000){error("uncertain")})
        File(folder.root,"communication-recovery-v1.state").writeText("corrupt")
        assertEquals(CommunicationRecoveryPreview.Status.UNKNOWN,attempt(whatsapp,500000){error("corrupt")})
    }
}

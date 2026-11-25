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
class CancellationOutboxPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private val email = AppointmentCancellationPreview.Intent("a".repeat(64),AppointmentCancellationPreview.Channel.EMAIL)
    private val whatsapp = AppointmentCancellationPreview.Intent("b".repeat(64),AppointmentCancellationPreview.Channel.WHATSAPP)
    private val success = PersistentReminderPreviewLedger.Result.CLAIMED
    private val failure = PersistentReminderPreviewLedger.Result.STORAGE_FAILURE
    private fun queue() = CancellationOutboxPreview(folder.root)
    @Test fun independentRecoveryAcrossRestarts() {
        assertTrue(queue().enqueue(listOf(email,whatsapp)))
        assertEquals(CancellationOutboxPreview.Status.PROCESSED,queue().attempt(email,100) { success })
        assertEquals(CancellationOutboxPreview.Status.PENDING,queue().attempt(whatsapp,100) { failure })
        assertTrue(queue().enqueue(listOf(email,whatsapp)))
        assertEquals(CancellationOutboxPreview.Status.PROCESSED,queue().attempt(email,30100) { fail("duplicate"); success })
        assertEquals(CancellationOutboxPreview.Status.WAIT,queue().attempt(whatsapp,30099) { fail("early"); success })
        assertEquals(CancellationOutboxPreview.Status.PROCESSED,queue().attempt(whatsapp,30100) { success })
    }
    @Test fun exhaustedAndUnknownAreTerminal() {
        assertTrue(queue().enqueue(listOf(email,whatsapp)))
        queue().attempt(email,100) { failure }
        queue().attempt(email,30100) { failure }
        assertEquals(CancellationOutboxPreview.Status.EXHAUSTED,queue().attempt(email,150100) { failure })
        assertEquals(CancellationOutboxPreview.Status.EXHAUSTED,queue().attempt(email,200000) { fail("extra"); success })
        assertEquals(CancellationOutboxPreview.Status.UNKNOWN,queue().attempt(whatsapp,100) { error("ambiguous") })
        assertEquals(CancellationOutboxPreview.Status.UNKNOWN,queue().attempt(whatsapp,200000) { fail("unsafe"); success })
    }
    @Test fun corruptionBlocks() {
        assertTrue(queue().enqueue(listOf(email)))
        val file = File(folder.root,"cancellation-outbox-v1.state")
        file.writeText("corrupt")
        assertFalse(queue().enqueue(listOf(whatsapp)))
        assertEquals(CancellationOutboxPreview.Status.UNKNOWN,queue().attempt(email,100) { fail("corrupt"); success })
    }
}

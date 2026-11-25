package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.util.concurrent.Executors
import java.util.concurrent.Callable
import java.util.concurrent.atomic.AtomicInteger

class CancellationWhatsAppPreviewTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",1795622400000L)
    private val contact = CustomerCommunicationPolicy.Contact("customer","test@example.invalid","+447000000000")
    private val consent = NotificationPreferences.CustomerConsent("customer",true,true,1)
    private val business = CancellationMessageTemplate.Business("owner","Demo Salon","demo-salon","Europe/London")
    private fun attempt(p: CancellationWhatsAppPreview, c: NotificationPreferences.CustomerConsent = consent, owner: String = "owner") =
        p.attempt(snapshot,owner,owner,business,contact,c,100)
    @Test fun concurrentAttemptsOnlySimulateOnce() {
        val calls = AtomicInteger()
        val p = CancellationWhatsAppPreview { e ->
            calls.incrementAndGet()
            assertEquals(contact.phone,e.recipient)
            assertTrue(e.body.contains("Demo Salon"))
            assertTrue(e.body.contains("has been cancelled"))
            CancellationWhatsAppPreview.Response.ACCEPTED
        }
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { attempt(p) } }).map { it.get() }
            assertEquals(1,calls.get())
            assertEquals(1,results.count { it == CancellationWhatsAppPreview.Outcome.ACCEPTED })
            assertEquals(63,results.count { it == CancellationWhatsAppPreview.Outcome.DUPLICATE })
        } finally { pool.shutdownNow() }
    }
    @Test fun failuresDoNotRepeatAutomatically() {
        for (response in CancellationWhatsAppPreview.Response.values()) {
            val p = CancellationWhatsAppPreview { response }
            assertEquals(response.name,attempt(p).name)
            assertEquals(CancellationWhatsAppPreview.Outcome.DUPLICATE,attempt(p))
        }
        val p = CancellationWhatsAppPreview { throw IllegalStateException("simulated failure") }
        assertEquals(CancellationWhatsAppPreview.Outcome.UNKNOWN,attempt(p))
        assertEquals(CancellationWhatsAppPreview.Outcome.DUPLICATE,attempt(p))
    }
    @Test fun invalidRequestsNeverReachProvider() {
        val calls = AtomicInteger()
        val p = CancellationWhatsAppPreview { calls.incrementAndGet(); CancellationWhatsAppPreview.Response.ACCEPTED }
        assertEquals(CancellationWhatsAppPreview.Outcome.INVALID,attempt(p,owner="other"))
        assertEquals(CancellationWhatsAppPreview.Outcome.INVALID,attempt(p,c=consent.copy(whatsappContactAllowed=false)))
        assertEquals(0,calls.get())
        assertEquals(CancellationWhatsAppPreview.Outcome.ACCEPTED,attempt(p))
    }
    @Test fun invalidPhoneAndIndependentEmailChannel() {
        val p = CancellationWhatsAppPreview { CancellationWhatsAppPreview.Response.UNAVAILABLE }
        for (phone in listOf("07000000000","+0123456789","+4470000000000x","+123","+1234567890123456")) {
            assertEquals(CancellationWhatsAppPreview.Outcome.INVALID,
                p.attempt(snapshot,"owner","owner",business,contact.copy(phone=phone),consent,100))
        }
        assertEquals(CancellationWhatsAppPreview.Outcome.INVALID,attempt(p,c=consent.copy(consentWithdrawnAtMillis=50)))
        assertEquals(CancellationWhatsAppPreview.Outcome.UNAVAILABLE,attempt(p))
        val email = CancellationEmailPreview { CancellationEmailPreview.Response.ACCEPTED }
        assertEquals(CancellationEmailPreview.Outcome.ACCEPTED,email.attempt(snapshot,"owner","owner",business,contact,consent,100))
    }
}

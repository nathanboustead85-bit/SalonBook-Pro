package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import java.util.concurrent.Executors
import java.util.concurrent.Callable
import java.util.concurrent.atomic.AtomicInteger

class CancellationEmailPreviewTest {
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",1795622400000L)
    private val contact = CustomerCommunicationPolicy.Contact("customer","test@example.invalid","+447000000000")
    private val consent = NotificationPreferences.CustomerConsent("customer",true,true,1)
    private val business = CancellationMessageTemplate.Business("owner","Demo Salon","demo-salon","Europe/London")
    private fun attempt(p: CancellationEmailPreview, c: NotificationPreferences.CustomerConsent = consent, owner: String = "owner") =
        p.attempt(snapshot,owner,owner,business,contact,c,100)
    @Test fun concurrentAttemptsOnlySimulateOnce() {
        val calls = AtomicInteger()
        val p = CancellationEmailPreview { e ->
            calls.incrementAndGet()
            assertEquals(contact.email,e.recipient)
            assertTrue(e.subject.contains("Demo Salon"))
            assertTrue(e.body.contains("has been cancelled"))
            CancellationEmailPreview.Response.ACCEPTED
        }
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { attempt(p) } }).map { it.get() }
            assertEquals(1,calls.get())
            assertEquals(1,results.count { it == CancellationEmailPreview.Outcome.ACCEPTED })
            assertEquals(63,results.count { it == CancellationEmailPreview.Outcome.DUPLICATE })
        } finally { pool.shutdownNow() }
    }
    @Test fun failuresDoNotRepeatAutomatically() {
        for (response in CancellationEmailPreview.Response.values()) {
            val p = CancellationEmailPreview { response }
            assertEquals(response.name,attempt(p).name)
            assertEquals(CancellationEmailPreview.Outcome.DUPLICATE,attempt(p))
        }
        val p = CancellationEmailPreview { throw IllegalStateException("simulated failure") }
        assertEquals(CancellationEmailPreview.Outcome.UNKNOWN,attempt(p))
        assertEquals(CancellationEmailPreview.Outcome.DUPLICATE,attempt(p))
    }
    @Test fun invalidRequestsNeverReachProvider() {
        val calls = AtomicInteger()
        val p = CancellationEmailPreview { calls.incrementAndGet(); CancellationEmailPreview.Response.ACCEPTED }
        assertEquals(CancellationEmailPreview.Outcome.INVALID,attempt(p,owner="other"))
        assertEquals(CancellationEmailPreview.Outcome.INVALID,attempt(p,c=consent.copy(emailNotificationsAllowed=false)))
        assertEquals(0,calls.get())
        assertEquals(CancellationEmailPreview.Outcome.ACCEPTED,attempt(p))
    }
}

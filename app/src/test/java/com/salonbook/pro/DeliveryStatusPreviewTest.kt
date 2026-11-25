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
class DeliveryStatusPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private val booking = NotificationSafetyPolicy.BookingSnapshot("owner","booking",2,true,true,"test@example.invalid",true,true)
    private val snapshot = SecureReminderPlan.Snapshot(booking,"customer",1795622400000L)
    private val email = AppointmentCancellationPreview.Channel.EMAIL
    private val whatsapp = AppointmentCancellationPreview.Channel.WHATSAPP
    private fun update(channel: AppointmentCancellationPreview.Channel, time: Long, status: DeliveryStatusPreview.Status, owner: String = "owner") =
        DeliveryStatusPreview(folder.root).update(snapshot,owner,owner,channel,time,status)
    @Test fun transitionsAndRestart() {
        val s = DeliveryStatusPreview.Status.PENDING
        val a = DeliveryStatusPreview.Status.ACCEPTED
        val d = DeliveryStatusPreview.Status.DELIVERED
        val f = DeliveryStatusPreview.Status.FAILED
        val u = DeliveryStatusPreview.Status.UNKNOWN
        assertEquals(DeliveryStatusPreview.Result.INVALID,update(email,10,d))
        assertEquals(DeliveryStatusPreview.Result.UPDATED,update(email,10,s))
        assertEquals(DeliveryStatusPreview.Result.UPDATED,update(whatsapp,10,s))
        assertEquals(DeliveryStatusPreview.Result.UPDATED,update(email,20,a))
        assertEquals(DeliveryStatusPreview.Result.STALE,update(email,19,f))
        assertEquals(DeliveryStatusPreview.Result.STALE,update(email,20,d))
        assertEquals(DeliveryStatusPreview.Result.DUPLICATE,update(email,20,a))
        assertEquals(DeliveryStatusPreview.Result.UPDATED,update(email,30,d))
        assertEquals(DeliveryStatusPreview.Result.INVALID,update(email,40,f))
        assertEquals(DeliveryStatusPreview.Result.UPDATED,update(whatsapp,20,u))
        assertEquals(DeliveryStatusPreview.Result.INVALID,update(whatsapp,30,s))
        val reopened = DeliveryStatusPreview(folder.root)
        assertEquals(d,reopened.lookup(snapshot,"owner","owner",email)!!.status)
        assertEquals(u,reopened.lookup(snapshot,"owner","owner",whatsapp)!!.status)
        assertNull(reopened.lookup(snapshot,"other","other",email))
        assertEquals(DeliveryStatusPreview.Result.INVALID,update(email,50,f,"other"))
    }
    @Test fun concurrentAndCorruptStorage() {
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { update(email,10,DeliveryStatusPreview.Status.PENDING) } }).map { it.get() }
            assertEquals(1,results.count { it == DeliveryStatusPreview.Result.UPDATED })
            assertEquals(63,results.count { it == DeliveryStatusPreview.Result.DUPLICATE })
        } finally { pool.shutdownNow() }
        File(folder.root,"delivery-status-v1.state").writeText("corrupt")
        assertEquals(DeliveryStatusPreview.Result.STORAGE_FAILURE,update(email,20,DeliveryStatusPreview.Status.ACCEPTED))
        assertNull(DeliveryStatusPreview(folder.root).lookup(snapshot,"owner","owner",email))
    }
}

package com.salonbook.pro
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*

class IsolatedBookingConnectorTest {
    private fun request() = JSONObject().put("businessId","owner").put("actorId","owner").put("requestId","r").put("appointmentId","a").put("expectedRevision",0)
    private fun receipt() = request().put("receiptVersion",1).put("accepted",true).put("status","accepted").put("revision",1)
    @Test fun validReceipt() {
        val c = IsolatedBookingConnector({ "owner" to "test-token" }, { token, body ->
            assertEquals("test-token",token)
            assertEquals("r",JSONObject(body).getString("requestId"))
            receipt().toString()
        })
        assertEquals(1,c.submit(request()).getInt("revision"))
    }
    @Test fun wrongReceiptRejected() {
        val c = IsolatedBookingConnector({ "owner" to "test-token" }, { _, _ -> receipt().put("actorId","other").toString() })
        assertTrue(runCatching { c.submit(request()) }.isFailure)
    }
    @Test fun changedSessionRejected() {
        var current = "owner" to "test-token"
        val c = IsolatedBookingConnector({ current }, { _, _ -> current = "other" to "other-token"; receipt().toString() })
        assertTrue(runCatching { c.submit(request()) }.isFailure)
    }
}

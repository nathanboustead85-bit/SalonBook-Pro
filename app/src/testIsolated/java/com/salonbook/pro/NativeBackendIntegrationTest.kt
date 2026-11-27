package com.salonbook.pro

import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import org.junit.Assume.assumeTrue

class NativeBackendIntegrationTest {
    @Test fun authenticatedBookingAndReplay() {
        val port = System.getenv("BOUSTIO_TEST_PORT")
        assumeTrue(port != null)
        val uid = requireNotNull(System.getenv("BOUSTIO_TEST_UID"))
        val token = requireNotNull(System.getenv("BOUSTIO_TEST_TOKEN"))
        val date = requireNotNull(System.getenv("BOUSTIO_TEST_DATE"))
        val transport = LoopbackBookingTransport(requireNotNull(port).toInt())
        val connector = IsolatedBookingConnector({ Pair(uid, token) }, transport::submit)
        val request = JSONObject().put("businessId",uid).put("actorId",uid)
            .put("appointmentId","native-booking").put("requestId","native-create")
            .put("action","create").put("expectedRevision",0)
            .put("serviceId","cut").put("staffId","staff").put("date",date).put("startTime","09:00")
        var lost = false
        val interrupted = IsolatedBookingConnector({ Pair(uid,token) }) { t, body ->
            val receipt = transport.submit(t,body)
            if (!lost) {
                lost = true
                throw java.io.IOException("Simulated lost acknowledgement after server commit")
            }
            receipt
        }
        assertTrue(runCatching { interrupted.submit(request) }.exceptionOrNull() is java.io.IOException)
        assertTrue(lost)
        val first = interrupted.submit(request)
        assertEquals(1L,first.getLong("revision"))
        assertEquals(first.toString(),connector.submit(request).toString())
        val invalid = IsolatedBookingConnector({ Pair(uid,"invalid") },transport::submit)
        assertTrue(runCatching { invalid.submit(request) }.isFailure)
        val other = requireNotNull(System.getenv("BOUSTIO_TEST_OTHER_TOKEN"))
        val mismatched = IsolatedBookingConnector({ Pair(uid,other) },transport::submit)
        assertTrue(runCatching { mismatched.submit(request) }.isFailure)
        val fresh = JSONObject(request.toString()).put("appointmentId","wrong-identity").put("requestId","wrong-identity").put("startTime","10:00")
        assertTrue(runCatching { mismatched.submit(fresh) }.isFailure)
        var session: Pair<String,String>? = Pair(uid,token)
        val switching = IsolatedBookingConnector({session}) { t, body ->
            val receipt = transport.submit(t,body)
            session = null
            receipt
        }
        assertTrue(runCatching { switching.submit(request) }.isFailure)
        assertTrue(runCatching { switching.submit(request) }.isFailure)
        assertEquals(first.toString(),connector.submit(request).toString())
    }
}

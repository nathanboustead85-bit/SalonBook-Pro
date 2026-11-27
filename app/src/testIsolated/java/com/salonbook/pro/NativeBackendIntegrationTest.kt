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
        val first = connector.submit(request)
        assertEquals(1L,first.getLong("revision"))
        assertEquals(first.toString(),connector.submit(request).toString())
        val invalid = IsolatedBookingConnector({ Pair(uid,"invalid") },transport::submit)
        assertTrue(runCatching { invalid.submit(request) }.isFailure)
    }
}

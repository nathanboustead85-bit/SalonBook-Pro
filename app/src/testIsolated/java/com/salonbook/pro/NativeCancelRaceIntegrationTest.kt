package com.salonbook.pro
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
class NativeCancelRaceIntegrationTest {
 @Test fun competeForRevision() {
  val port=System.getenv("BOUSTIO_TEST_PORT")
  assumeTrue(port!=null && System.getenv("BOUSTIO_TEST_RACE")=="1")
  val uid=requireNotNull(System.getenv("BOUSTIO_TEST_UID"))
  val token=requireNotNull(System.getenv("BOUSTIO_TEST_TOKEN"))
  val transport=LoopbackBookingTransport(requireNotNull(port).toInt())
  val connector=IsolatedBookingConnector({Pair(uid,token)},transport::submit)
  val request=JSONObject().put("businessId",uid).put("actorId",uid).put("appointmentId","shared-race").put("requestId","native-cancel").put("action","cancel").put("expectedRevision",1).put("serviceId","cut").put("staffId","staff").put("date",requireNotNull(System.getenv("BOUSTIO_TEST_DATE"))).put("startTime","11:00")
  val result=runCatching { connector.submit(request) }
  if(result.isSuccess) assertEquals(2L,result.getOrThrow().getLong("revision"))
 }
}

package com.salonbook.pro
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
class NativeRaceIntegrationTest {
 @Test fun competeForSlot() {
  val port=System.getenv("BOUSTIO_TEST_PORT")
  assumeTrue(port!=null && System.getenv("BOUSTIO_TEST_RACE")=="1")
  val uid=requireNotNull(System.getenv("BOUSTIO_TEST_UID"))
  val token=requireNotNull(System.getenv("BOUSTIO_TEST_TOKEN"))
  val transport=LoopbackBookingTransport(requireNotNull(port).toInt())
  val connector=IsolatedBookingConnector({Pair(uid,token)},transport::submit)
  val request=JSONObject().put("businessId",uid).put("actorId",uid).put("appointmentId","native-race").put("requestId","native-race").put("action","create").put("expectedRevision",0).put("serviceId","cut").put("staffId","staff").put("date",requireNotNull(System.getenv("BOUSTIO_TEST_DATE"))).put("startTime","09:00")
  val result=runCatching { connector.submit(request) }
  if(result.isSuccess) assertEquals(1L,result.getOrThrow().getLong("revision"))
 }
}

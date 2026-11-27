package com.salonbook.pro

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import org.junit.Test
import org.junit.Assert.*

class LoopbackBookingTransportTest {
    @Test fun realLoopbackAndRetry() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1",0),0)
        var calls = 0
        server.createContext("/booking") { exchange ->
            val valid = exchange.requestHeaders.getFirst("Authorization") == "Bearer test.token" &&
                exchange.requestBody.bufferedReader().use { it.readText() } == "{}"
            calls++
            val response = "{}".toByteArray()
            exchange.sendResponseHeaders(if (valid && calls > 1) 200 else 503,response.size.toLong())
            exchange.responseBody.use { it.write(response) }
        }
        server.start()
        try {
            val transport = LoopbackBookingTransport(server.address.port)
            assertTrue(runCatching { transport.submit("test.token","{}") }.isFailure)
            assertEquals("{}",transport.submit("test.token","{}"))
            assertEquals(2,calls)
        } finally { server.stop(0) }
    }
}

package com.salonbook.pro

import java.net.ServerSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Test
import org.junit.Assert.*

class LoopbackBookingTransportTest {
    @Test fun realLoopbackAndRetry() {
        ServerSocket(0, 2, InetAddress.getByName("127.0.0.1")).use { server ->
            server.soTimeout = 10000
            val executor = Executors.newSingleThreadExecutor()
            try {
                val task = executor.submit {
                    repeat(2) { index ->
                        server.accept().use { socket ->
                            socket.soTimeout = 5000
                            val reader = socket.getInputStream().bufferedReader(Charsets.UTF_8)
                            assertEquals("POST /booking HTTP/1.1", reader.readLine())
                            val headers = mutableMapOf<String,String>()
                            while (true) {
                                val line = reader.readLine() ?: error("Incomplete headers")
                                if (line.isEmpty()) break
                                headers[line.substringBefore(':').lowercase()] = line.substringAfter(':').trim()
                            }
                            assertEquals("Bearer test.token", headers["authorization"])
                            assertEquals("2", headers["content-length"])
                            assertEquals('{'.code, reader.read())
                            assertEquals('}'.code, reader.read())
                            val status = if (index == 0) "503 Service Unavailable" else "200 OK"
                            socket.getOutputStream().apply {
                                write(("HTTP/1.1 $status\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}").toByteArray(Charsets.UTF_8))
                                flush()
                            }
                        }
                    }
                }
                val transport = LoopbackBookingTransport(server.localPort)
                assertTrue(runCatching { transport.submit("test.token","{}") }.isFailure)
                assertEquals("{}",transport.submit("test.token","{}"))
                task.get(15, TimeUnit.SECONDS)
            } finally { executor.shutdownNow() }
        }
    }
}

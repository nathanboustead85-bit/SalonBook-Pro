package com.salonbook.pro
import java.net.ServerSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Test
import org.junit.Assert.*

class TransportResponseLimitTest {
    private fun response(size: Int): Result<String> {
        ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")).use { server ->
            server.soTimeout = 10000
            val executor = Executors.newSingleThreadExecutor()
            try {
                val task = executor.submit {
                    server.accept().use { socket ->
                        socket.soTimeout = 5000
                        val reader = socket.getInputStream().bufferedReader(Charsets.UTF_8)
                        while (true) {
                            val line = reader.readLine() ?: error("Incomplete request")
                            if (line.isEmpty()) break
                        }
                        assertEquals('{'.code, reader.read())
                        assertEquals('}'.code, reader.read())
                        socket.getOutputStream().apply {
                            write("HTTP/1.1 200 OK\r\nContent-Length: $size\r\nConnection: close\r\n\r\n".toByteArray())
                            write(ByteArray(size) { 65 })
                            flush()
                        }
                    }
                }
                val result = runCatching { LoopbackBookingTransport(server.localPort).submit("test.token","{}") }
                task.get(15, TimeUnit.SECONDS)
                return result
            } finally { executor.shutdownNow() }
        }
    }
    @Test fun acceptsExactLimit() { assertEquals(65536,response(65536).getOrThrow().length) }
    @Test fun rejectsOversize() { assertEquals("Response too large",response(65537).exceptionOrNull()?.message) }
}

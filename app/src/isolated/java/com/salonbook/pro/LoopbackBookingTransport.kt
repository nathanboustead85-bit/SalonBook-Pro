package com.salonbook.pro

import java.net.HttpURLConnection
import java.net.URL

// CI-only loopback transport; TEST APK still has no INTERNET permission.
internal class LoopbackBookingTransport(private val port: Int) {
    init { require(port in 1024..65535) }
    fun submit(token: String, body: String): String {
        require(token.matches(Regex("[A-Za-z0-9_.-]{1,8192}")))
        require(body.toByteArray(Charsets.UTF_8).size <= 65536)
        val connection = URL("http://127.0.0.1:$port/booking").openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            check(connection.responseCode == 200) { "Booking response unavailable" }
            return connection.inputStream.use { stream ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    val count = stream.read(buffer)
                    if (count == -1) break
                    check(output.size() + count <= 65536) { "Response too large" }
                    output.write(buffer, 0, count)
                }
                String(output.toByteArray(), Charsets.UTF_8)
            }
        } finally { connection.disconnect() }
    }
}

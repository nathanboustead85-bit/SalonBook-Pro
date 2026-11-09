package com.salonbook.pro.debug

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Emulator-only, read-only calendar adapter. No production Firebase credentials,
 * no public endpoint, no persistent token storage.
 */
object EmulatorCalendarFeed {
    private const val ENDPOINT = "http://127.0.0.1:8765/api/owner-calendar"
    private val idPattern = Regex("demo_[A-Za-z0-9_-]{3,75}")
    private val datePattern = Regex("\\d{4}-\\d{2}-\\d{2}")
    data class Appointment(val id: String, val time: String, val service: String, val staff: String, val status: String)
    data class Snapshot(val appointments: List<Appointment>)

    fun fetch(businessId: String, ownerToken: String, date: String): Snapshot {
        require(idPattern.matches(businessId)) { "Synthetic business ID required" }
        require(datePattern.matches(date) && java.time.LocalDate.parse(date).toString() == date) { "Invalid date" }
        require(ownerToken.isNotBlank()) { "Auth emulator owner token required" }
        val connection = URL(ENDPOINT).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 2500
            connection.readTimeout = 2500
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject()
                .put("businessId", businessId)
                .put("ownerToken", ownerToken)
                .put("date", date)
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            check(connection.responseCode == 200) { "Local emulator owner feed unavailable or access denied" }
            val json = connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
            check(json.getString("businessId") == businessId && json.getString("date") == date)
            val array: JSONArray = json.getJSONArray("appointments")
            val seen = HashSet<String>()
            val result = ArrayList<Appointment>()
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                val id = item.getString("id")
                val status = item.getString("status")
                check(id.isNotBlank() && seen.add(id)) { "Duplicate or invalid booking" }
                check(item.getString("source") == "demo_customer_web") { "Non-demo booking rejected" }
                check(status == "confirmed" || status == "cancelled") { "Invalid status" }
                check(item.getString("localDate") == date) { "Incorrect booking date" }
                val time = Instant.parse(item.getString("startAt"))
                    .atZone(ZoneId.of("Europe/London"))
                    .format(DateTimeFormatter.ofPattern("HH:mm"))
                result.add(Appointment(id, time, item.getString("serviceId"), item.getString("staffId"), status))
            }
            return Snapshot(result)
        } finally {
            connection.disconnect()
        }
    }
}

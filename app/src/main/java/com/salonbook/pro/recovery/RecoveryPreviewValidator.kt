package com.salonbook.pro.recovery

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Offline, side-effect-free validation for a future disposable Android restore test.
 * NOT wired into CloudActivity and NEVER writes SharedPreferences or Firebase.
 */
object RecoveryPreviewValidator {
    const val MAX_FIELD_LENGTH = 500000

    data class Snapshot(
        val bookings: String,
        val services: String,
        val staff: String,
        val bookingCount: Int,
        val serviceCount: Int,
        val staffCount: Int
    )

    fun validate(
        schemaVersion: Long?,
        bookings: String?,
        services: String?,
        staff: String?
    ): Snapshot {
        require(schemaVersion == 1L) { "Unsupported backup schema" }
        val bookingsArray = parseArray("bookings", bookings)
        val servicesArray = parseArray("services", services)
        val staffArray = parseArray("staff", staff)
        val ids = mutableSetOf<String>()
        for (index in 0 until bookingsArray.length()) {
            val booking = bookingsArray.optJSONObject(index)
                ?: throw IllegalArgumentException("Invalid booking record")
            val id = booking.optString("id", "")
            require(id.isNotBlank() && ids.add(id)) { "Missing or duplicate booking ID" }
        }
        return Snapshot(
            bookings!!, services!!, staff!!,
            bookingsArray.length(), servicesArray.length(), staffArray.length()
        )
    }

    private fun parseArray(name: String, raw: String?): JSONArray {
        require(raw != null && raw.length <= MAX_FIELD_LENGTH) {
            "Missing or oversized $name"
        }
        return try {
            JSONArray(raw)
        } catch (_: JSONException) {
            throw IllegalArgumentException("Invalid $name JSON array")
        }
    }
}

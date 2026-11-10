package com.salonbook.pro.debug

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Debug-only, device-local cache for the emulator calendar preview.
 * Never stores owner tokens, never writes production appointments, and
 * never treats cached bookings as an authoritative source.
 */
internal class DebugCalendarDiskCache(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("boustio_debug_calendar_cache_v1", Context.MODE_PRIVATE)

    fun save(businessId: String, date: String, appointments: List<EmulatorCalendarFeed.Appointment>) {
        require(businessId.startsWith("demo_"))
        require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(date))
        val entries = JSONArray()
        appointments.forEach { item ->
            entries.put(JSONObject().apply {
                put("id", item.id)
                put("time", item.time)
                put("service", item.service)
                put("staff", item.staff)
                put("status", item.status)
            })
        }
        val value = JSONObject().apply {
            put("version", 1)
            put("businessId", businessId)
            put("date", date)
            put("appointments", entries)
        }.toString()
        check(prefs.edit().putString(key(businessId, date), value).commit()) { "Calendar cache write failed" }
    }

    fun load(businessId: String, date: String): List<EmulatorCalendarFeed.Appointment>? {
        if (!businessId.startsWith("demo_") || !Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)) return null
        val value = prefs.getString(key(businessId, date), null) ?: return null
        return try {
            val data = JSONObject(value)
            if (data.getInt("version") != 1 || data.getString("businessId") != businessId ||
                data.getString("date") != date) return null
            val entries = data.getJSONArray("appointments")
            if (entries.length() > 500) return null
            (0 until entries.length()).map { index ->
                val item = entries.getJSONObject(index)
                EmulatorCalendarFeed.Appointment(
                    item.getString("id"), item.getString("time"), item.getString("service"),
                    item.getString("staff"), item.getString("status")
                )
            }
        } catch (_: Exception) {
            null // Corrupt cache must never replace a verified server snapshot.
        }
    }

    fun clear(businessId: String, date: String) {
        prefs.edit().remove(key(businessId, date)).apply()
    }

    private fun key(businessId: String, date: String) = "feed_${businessId}_${date}"
}

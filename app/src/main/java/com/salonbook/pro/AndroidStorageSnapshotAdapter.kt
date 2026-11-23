package com.salonbook.pro

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.stream.JsonReader
import java.io.StringReader

/**
 * Phase 55.2: isolated, read-only snapshot capture with strict JSON validation.
 * No Android SharedPreferences implementation, migration, write or restore path.
 */
internal class AndroidStorageSnapshotAdapter(private val reader: PreferenceReader) {
    interface PreferenceReader {
        fun readString(key: String): String?
    }

    sealed class Capture {
        data class Success(val snapshot: RecoveryTransaction.Snapshot) : Capture()
        data class Rejected(val reason: String) : Capture()
    }

    fun capture(): Capture {
        val keys = listOf("bookings", "services", "staff")
        val values = try {
            keys.map { key -> reader.readString(key) }
        } catch (_: Exception) {
            return Capture.Rejected("Preference read failed")
        }
        if (values.any { it == null }) return Capture.Rejected("One or more preference keys missing")
        val present = values.filterNotNull()
        if (present.any { it.toByteArray(Charsets.UTF_8).size > 1_000_000 }) {
            return Capture.Rejected("Preference payload too large")
        }
        for (index in keys.indices) {
            val rejection = validateArray(keys[index], present[index])
            if (rejection != null) return Capture.Rejected(rejection)
        }
        return Capture.Success(RecoveryTransaction.Snapshot(present[0], present[1], present[2]))
    }

    private fun validateArray(key: String, raw: String): String? {
        val parsed: JsonArray = try {
            val jsonReader = JsonReader(StringReader(raw))
            jsonReader.isLenient = false
            val value = JsonParser.parseReader(jsonReader)
            if (!value.isJsonArray) return "$key is not a JSON array"
            value.asJsonArray
        } catch (_: Exception) {
            return "$key contains malformed JSON"
        }
        val ids = mutableSetOf<String>()
        for (entry in parsed) {
            if (!entry.isJsonObject) return "$key contains a non-object record"
            val obj: JsonObject = entry.asJsonObject
            if (key == "bookings") {
                val id = readStringId(obj) ?: return "Booking ID missing or invalid"
                if (!ids.add(id)) return "Duplicate booking ID"
            } else if (obj.has("id")) {
                val id = readStringId(obj) ?: return "$key ID invalid"
                if (!ids.add(id)) return "Duplicate $key ID"
            }
        }
        return null
    }

    private fun readStringId(obj: JsonObject): String? {
        val value = obj.get("id") ?: return null
        if (!value.isJsonPrimitive || !value.asJsonPrimitive.isString) return null
        val id = value.asString
        return id.takeIf { it.isNotBlank() && it.length <= 256 }
    }
}

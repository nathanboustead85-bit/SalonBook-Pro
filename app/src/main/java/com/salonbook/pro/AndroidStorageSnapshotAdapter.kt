package com.salonbook.pro

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.google.gson.Strictness
import java.io.StringReader

/**
 * Phase 55.3: isolated, read-only snapshot capture with strict JSON validation.
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

    /**
     * Two complete read passes must match byte-for-byte. This detects many
     * concurrent edits, but is NOT an atomic cross-key snapshot: ABA changes
     * and writes between the second pass and return remain possible.
     */
    fun capture(): Capture {
        val keys = listOf("bookings", "services", "staff")
        val first = readPass(keys) ?: return Capture.Rejected("Preference read failed or key missing")
        val firstError = validatePass(keys, first)
        if (firstError != null) return Capture.Rejected(firstError)

        val second = readPass(keys) ?: return Capture.Rejected("Preference re-read failed or key missing")
        if (first != second) return Capture.Rejected("Preferences changed during snapshot capture")
        val secondError = validatePass(keys, second)
        if (secondError != null) return Capture.Rejected(secondError)
        return Capture.Success(RecoveryTransaction.Snapshot(second[0], second[1], second[2]))
    }

    private fun readPass(keys: List<String>): List<String>? = try {
        val values = keys.map { reader.readString(it) }
        if (values.any { it == null }) null else values.filterNotNull()
    } catch (_: Exception) {
        null
    }

    private fun validatePass(keys: List<String>, values: List<String>): String? {
        if (values.any { it.toByteArray(Charsets.UTF_8).size > 1_000_000 }) {
            return "Preference payload too large"
        }
        for (index in keys.indices) {
            val rejection = validateArray(keys[index], values[index])
            if (rejection != null) return rejection
        }
        return null
    }

    private fun validateArray(key: String, raw: String): String? {
        val parsed: JsonArray = try {
            val jsonReader = JsonReader(StringReader(raw))
            jsonReader.strictness = Strictness.STRICT
            jsonReader.skipValue()
            if (jsonReader.peek() != JsonToken.END_DOCUMENT) return "$key has trailing content"
            val value = JsonParser.parseString(raw)
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

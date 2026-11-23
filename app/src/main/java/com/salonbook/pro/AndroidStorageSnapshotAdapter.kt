package com.salonbook.pro

/**
 * Phase 55.1: read-only boundary for the existing salonbook_data preference keys.
 * Not connected to an Activity, Firebase, or the installed app.
 * A real SharedPreferences implementation is intentionally not supplied yet.
 */
internal class AndroidStorageSnapshotAdapter(private val reader: PreferenceReader) {
    interface PreferenceReader {
        /** Null means missing; never silently substitute an empty array. */
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
        // Full JSON schema validation must be implemented before any real-data use.
        if (present.any { !it.trim().startsWith("[") || !it.trim().endsWith("]") }) {
            return Capture.Rejected("Preference payload is not array-shaped")
        }
        return Capture.Success(RecoveryTransaction.Snapshot(present[0], present[1], present[2]))
    }
}

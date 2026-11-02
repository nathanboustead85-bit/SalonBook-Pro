package com.salonbook.pro

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Boustio Phase 7E:
 * Safe public business catalogue converter.
 *
 * Security:
 * - Excludes Firebase account UID
 * - Excludes private customer records
 * - Excludes private bookings
 * - Excludes private login email
 * - Exports only public-visible services
 * - Exports only public-visible staff
 * - Keeps publishing disabled
 * - Keeps online bookings disabled
 */
object BusinessCatalogueBuilder {

    private val days = listOf(
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
    )

    private val shortDays = listOf(
        "mon",
        "tue",
        "wed",
        "thu",
        "fri",
        "sat",
        "sun"
    )

    fun build(
        profile: BusinessProfile,
        servicesJson: String,
        staffJson: String
    ): JSONObject {

        require(profile.name.trim().length in 3..100) {
            "Enter a valid business name"
        }

        require(
            Regex("[a-z0-9]+(?:-[a-z0-9]+)*")
                .matches(profile.slug)
        ) {
            "Invalid business booking slug"
        }

        require(profile.slug.length in 3..50) {
            "Invalid booking slug length"
        }

        val rawServices = JSONArray(servicesJson)
        val rawStaff = JSONArray(staffJson)

        val services = convertServices(rawServices)
        val staff = convertStaff(rawStaff, services)

        val business = JSONObject().apply {

            // Use the public slug, not the
            // owner's internal Firebase UID.
            put("businessId", profile.slug)

            put("name", profile.name.trim())
            put("slug", profile.slug)
            put("category", profile.category.trim())
            put(
                "description",
                profile.description.trim()
            )
            put("address", profile.address.trim())

            // Do not export private account contact data.
            put("phone", "")

            // Exporting must not publish or
            // activate online bookings.
            put("published", false)
            put("acceptingBookings", false)
        }

        return JSONObject().apply {
            put("schemaVersion", 1)
            put("business", business)
            put("services", services)
            put("staff", staff)
            put(
                "workingHours",
                createWorkingHours(rawStaff)
            )
        }
    }

    /**
     * Only export services explicitly
     * marked as publicly visible.
     *
     * Existing services without the flag
     * remain hidden by default.
     */
    private fun convertServices(
        rawServices: JSONArray
    ): JSONArray {

        val result = JSONArray()
        val usedIds = mutableSetOf<String>()

        for (i in 0 until rawServices.length()) {

            val source = rawServices.optJSONObject(i)
                ?: continue

            if (!source.optBoolean("publicVisible", false)) {
                continue
            }

            val id = source.optString("id").trim()
            val name = source.optString("name").trim()

            val price = source.optString("price")
                .toDoubleOrNull()

            val duration = source.optInt(
                "duration", 0
            )

            if (
                id.isBlank() ||
                !usedIds.add(id) ||
                name.isBlank() ||
                name.length > 100 ||
                price == null ||
                !price.isFinite() ||
                price < 0.0 ||
                duration <= 0 ||
                duration > 1440
            ) {
                continue
            }

            result.put(
                JSONObject().apply {
                    put("id", id)
                    put("name", name)
                    put("description", "")
                    put(
                        "durationMinutes",
                        duration
                    )
                    put("price", price)
                    put("active", true)
                }
            )
        }

        return result
    }

    /**
     * Only export staff explicitly
     * marked as publicly visible.
     *
     * IMPORTANT:
     * Existing Android records do not yet
     * contain individual service assignments.
     *
     * All visible services are temporarily
     * assigned to visible staff for preview
     * purposes only.
     *
     * Real online bookings remain disabled.
     */
    private fun convertStaff(
        rawStaff: JSONArray,
        services: JSONArray
    ): JSONArray {

        val result = JSONArray()
        val usedIds = mutableSetOf<String>()
        val serviceIds = JSONArray()

        for (i in 0 until services.length()) {

            val service = services.optJSONObject(i)
                ?: continue

            serviceIds.put(
                service.getString("id")
            )
        }

        for (i in 0 until rawStaff.length()) {

            val source = rawStaff.optJSONObject(i)
                ?: continue

            if (!source.optBoolean("publicVisible", false)) {
                continue
            }

            val id = source.optString("id").trim()
            val name = source.optString("name").trim()

            if (
                id.isBlank() ||
                !usedIds.add(id) ||
                name.isBlank() ||
                name.length > 100
            ) {
                continue
            }

            val assignments = JSONArray()

            for (j in 0 until serviceIds.length()) {
                assignments.put(
                    serviceIds.getString(j)
                )
            }

            result.put(
                JSONObject().apply {
                    put("id", id)
                    put("name", name)
                    put("active", true)
                    put(
                        "serviceIds",
                        assignments
                    )
                }
            )
        }

        return result
    }

    /**
     * Generate conservative shared hours
     * using only staff selected for public
     * visibility.
     *
     * Hidden staff must not reduce the
     * public business opening hours.
     *
     * These are preview hours, not
     * appointment availability.
     */
    private fun createWorkingHours(
        rawStaff: JSONArray
    ): JSONObject {

        val weekly = JSONObject()

        val staffSchedules =
            mutableListOf<
                Map<String, Pair<Int, Int>>
            >()

        for (i in 0 until rawStaff.length()) {

            val member = rawStaff.optJSONObject(i)
                ?: continue

            if (!member.optBoolean("publicVisible", false)) {
                continue
            }

            if (
                member.optString("id").isBlank() ||
                member.optString("name").isBlank()
            ) {
                continue
            }

            staffSchedules.add(
                parseStaffHours(
                    member.optString("hours")
                )
            )
        }

        for (day in days) {

            val intervals = staffSchedules.mapNotNull {
                it[day]
            }

            if (
                staffSchedules.isEmpty() ||
                intervals.size != staffSchedules.size
            ) {
                weekly.put(
                    day,
                    JSONObject.NULL
                )
                continue
            }

            val opening = intervals.maxOf {
                it.first
            }

            val closing = intervals.minOf {
                it.second
            }

            if (opening >= closing) {

                weekly.put(
                    day,
                    JSONObject.NULL
                )

            } else {

                weekly.put(
                    day,
                    JSONObject().apply {
                        put(
                            "open",
                            formatTime(opening)
                        )
                        put(
                            "close",
                            formatTime(closing)
                        )
                    }
                )
            }
        }

        return weekly
    }

    /**
     * Supported formats:
     *
     * Mon-Fri 09:00-17:00
     * Mon-Sat 09:00-18:00
     * Mon 09:00-17:00
     *
     * Unrecognised schedules produce
     * no public hours.
     */
    private fun parseStaffHours(
        input: String
    ): Map<String, Pair<Int, Int>> {

        val result =
            mutableMapOf<
                String, Pair<Int, Int>
            >()

        val cleaned = input.trim()
            .lowercase(Locale.ROOT)

        val pattern = Regex(
            """\b(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?\s+([0-2]\d:[0-5]\d)\s*-\s*([0-2]\d:[0-5]\d)\b"""
        )

        val match = pattern.matchEntire(
            cleaned
        ) ?: return emptyMap()

        val startDay = shortDays.indexOf(
            match.groupValues[1]
        )

        val endDay = if (
            match.groupValues[2].isBlank()
        ) {
            startDay
        } else {
            shortDays.indexOf(
                match.groupValues[2]
            )
        }

        if (
            startDay < 0 ||
            endDay < startDay
        ) {
            return emptyMap()
        }

        val opening = parseTime(
            match.groupValues[3]
        ) ?: return emptyMap()

        val closing = parseTime(
            match.groupValues[4]
        ) ?: return emptyMap()

        if (opening >= closing) {
            return emptyMap()
        }

        for (index in startDay..endDay) {
            result[days[index]] =
                Pair(opening, closing)
        }

        return result
    }

    private fun parseTime(
        value: String
    ): Int? {

        val parts = value.split(":")

        if (parts.size != 2) {
            return null
        }

        val hour = parts[0].toIntOrNull()
            ?: return null

        val minute = parts[1].toIntOrNull()
            ?: return null

        if (
            hour !in 0..23 ||
            minute !in 0..59
        ) {
            return null
        }

        return hour * 60 + minute
    }

    private fun formatTime(
        minutes: Int
    ): String {

        val hour = minutes / 60
        val minute = minutes % 60

        return String.format(
            Locale.UK,
            "%02d:%02d",
            hour,
            minute
        )
    }
}

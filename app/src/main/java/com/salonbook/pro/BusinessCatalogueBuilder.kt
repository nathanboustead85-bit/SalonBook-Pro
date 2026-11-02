package com.salonbook.pro

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Phase 7D: Public business catalogue converter.
 *
 * Converts existing Android data into the
 * public booking website's JSON format.
 *
 * This class does not:
 * - access Firebase
 * - publish business information
 * - include private bookings or customer records
 * - enable online bookings
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

    /**
     * Create a public-preview catalogue.
     *
     * The caller must supply only the business
     * profile, services and staff.
     *
     * No bookings or customer data are accepted.
     */
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
            put("businessId", profile.businessId)
            put("name", profile.name.trim())
            put("slug", profile.slug)
            put("category", profile.category.trim())
            put("description", profile.description.trim())
            put("address", profile.address.trim())

            // Explicitly exclude the owner's
            // private login email.
            put("phone", "")

            // A generated preview must never
            // automatically become public.
            put("published", false)
            put("acceptingBookings", false)
        }

        val catalogue = JSONObject().apply {
            put("schemaVersion", 1)
            put("business", business)
            put("services", services)
            put("staff", staff)
            put("workingHours", createWorkingHours(rawStaff))
        }

        return catalogue
    }

    private fun convertServices(
        rawServices: JSONArray
    ): JSONArray {

        val result = JSONArray()
        val usedIds = mutableSetOf<String>()

        for (i in 0 until rawServices.length()) {

            val source = rawServices.optJSONObject(i)
                ?: continue

            val id = source.optString("id").trim()
            val name = source.optString("name").trim()

            val price = source.optString("price")
                .toDoubleOrNull()

            val duration = source.optInt("duration", 0)

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
                    put("durationMinutes", duration)
                    put("price", price)
                    put("active", true)
                }
            )
        }

        return result
    }

    private fun convertStaff(
        rawStaff: JSONArray,
        services: JSONArray
    ): JSONArray {

        val result = JSONArray()
        val usedIds = mutableSetOf<String>()

        // Existing Android staff records do not
        // specify which services each person offers.
        //
        // Until service assignments are implemented,
        // use all services for demonstration only.
        val serviceIds = JSONArray()

        for (i in 0 until services.length()) {
            val service = services.optJSONObject(i)
                ?: continue

            serviceIds.put(service.getString("id"))
        }

        for (i in 0 until rawStaff.length()) {

            val source = rawStaff.optJSONObject(i)
                ?: continue

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
                    put("serviceIds", assignments)
                }
            )
        }

        return result
    }

    /**
     * Derive conservative shared business hours
     * from existing staff hour strings.
     *
     * Only hours covered by every staff member
     * are included. This avoids advertising
     * times outside a member's stated hours.
     *
     * Individual staff availability will require
     * a separate model before real bookings.
     */
    private fun createWorkingHours(
        rawStaff: JSONArray
    ): JSONObject {

        val weekly = JSONObject()

        val staffSchedules =
            mutableListOf<Map<String, Pair<Int, Int>>>()

        for (i in 0 until rawStaff.length()) {

            val member = rawStaff.optJSONObject(i)
                ?: continue

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

            // Do not invent business hours if
            // any staff schedule is unknown.
            if (
                staffSchedules.isEmpty() ||
                intervals.size != staffSchedules.size
            ) {
                weekly.put(day, JSONObject.NULL)
                continue
            }

            val opening = intervals.maxOf {
                it.first
            }

            val closing = intervals.minOf {
                it.second
            }

            if (opening >= closing) {
                weekly.put(day, JSONObject.NULL)
            } else {
                weekly.put(
                    day,
                    JSONObject().apply {
                        put("open", formatTime(opening))
                        put("close", formatTime(closing))
                    }
                )
            }
        }

        return weekly
    }

    /**
     * Supported examples:
     *
     * Mon-Fri 09:00-17:00
     * Mon-Sat 09:00-18:00
     * Mon 09:00-17:00
     *
     * Unrecognised formats produce no hours
     * rather than inventing availability.
     */
    private fun parseStaffHours(
        input: String
    ): Map<String, Pair<Int, Int>> {

        val result =
            mutableMapOf<String, Pair<Int, Int>>()

        val cleaned = input.trim()
            .lowercase(Locale.ROOT)

        val pattern = Regex(
            """\b(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?\s+([0-2]\d:[0-5]\d)\s*-\s*([0-2]\d:[0-5]\d)\b"""
        )

        val match = pattern.matchEntire(cleaned)
            ?: return emptyMap()

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

package com.salonbook.pro

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Boustio Phase 7D:
 * Safe public business catalogue converter.
 *
 * Exports:
 * - Explicitly public services
 * - Explicitly public staff
 * - Individual staff service assignments
 * - Individual weekly working schedules
 * - Recurring weekly breaks
 * - Date-specific unavailable periods
 *
 * Does not export:
 * - Firebase account UID
 * - Customer records or bookings
 * - Login email
 * - Private staff or services
 * - Internal reasons for staff absence
 *
 * Publishing and online bookings stay disabled.
 */
object BusinessCatalogueBuilder {

    private val days = listOf(
        "monday", "tuesday", "wednesday",
        "thursday", "friday", "saturday", "sunday"
    )

    private val shortDays = listOf(
        "mon", "tue", "wed", "thu",
        "fri", "sat", "sun"
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
            // Public slug, never private Firebase UID.
            put("businessId", profile.slug)
            put("name", profile.name.trim())
            put("slug", profile.slug)
            put("category", profile.category.trim())
            put("description", profile.description.trim())
            put("address", profile.address.trim())

            // Do not expose account contact information.
            put("phone", "")

            // Phase 7 remains preview-only.
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
     * Only services explicitly marked public
     * may appear in the catalogue.
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
            val duration = source.optInt("duration", 0)

            if (
                id.isBlank() ||
                id in usedIds ||
                name.isBlank() ||
                name.length > 100 ||
                price == null ||
                !price.isFinite() ||
                price < 0 ||
                duration !in 1..1440
            ) {
                continue
            }

            usedIds.add(id)

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

    /**
     * Export staff assignments using the
     * serviceIds stored by ManagementActivity.
     *
     * Only IDs of exported public services
     * are permitted.
     *
     * Legacy staff without assignments receive
     * an empty array, never every service.
     */
    private fun convertStaff(
        rawStaff: JSONArray,
        services: JSONArray
    ): JSONArray {

        val result = JSONArray()
        val usedIds = mutableSetOf<String>()
        val publicServiceIds = mutableSetOf<String>()

        for (i in 0 until services.length()) {
            val service = services.optJSONObject(i)
                ?: continue
            publicServiceIds.add(
                service.optString("id")
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
                id in usedIds ||
                name.isBlank() ||
                name.length > 100
            ) {
                continue
            }

            usedIds.add(id)

            val assignments = JSONArray()
            val assigned = mutableSetOf<String>()
            val rawAssignments =
                source.optJSONArray("serviceIds")

            if (rawAssignments != null) {
                for (j in 0 until rawAssignments.length()) {
                    val serviceId = rawAssignments
                        .optString(j).trim()

                    if (
                        serviceId in publicServiceIds &&
                        assigned.add(serviceId)
                    ) {
                        assignments.put(serviceId)
                    }
                }
            }

            val schedule = staffSchedule(source)

            result.put(
                JSONObject().apply {
                    put("id", id)
                    put("name", name)
                    put("active", true)
                    put("serviceIds", assignments)
                    put(
                        "weeklySchedule",
                        exportSchedule(schedule)
                    )
                    put(
                        "weeklyBreaks",
                        exportWeeklyBreaks(
                            source.optJSONArray("weeklyBreaks"),
                            schedule
                        )
                    )
                    put(
                        "timeOff",
                        exportTimeOff(
                            source.optJSONArray("timeOff")
                        )
                    )
                }
            )
        }

        return result
    }

    /**
     * Read the structured schedule first.
     *
     * If it is absent, use the legacy
     * Mon-Fri 09:00-17:00 text format.
     *
     * An empty structured schedule means
     * no working days, not a fallback.
     */
    private fun staffSchedule(
        member: JSONObject
    ): Map<String, Pair<Int, Int>> {

        val structured =
            member.optJSONObject("weeklySchedule")

        if (structured == null) {
            return parseStaffHours(
                member.optString("hours")
            )
        }

        val result =
            mutableMapOf<String, Pair<Int, Int>>()

        for (day in days) {
            val period = structured.optJSONObject(day)
                ?: continue

            val open = parseTime(
                period.optString("open")
            ) ?: continue

            val close = parseTime(
                period.optString("close")
            ) ?: continue

            if (open < close) {
                result[day] = Pair(open, close)
            }
        }

        return result
    }

    private fun exportSchedule(
        schedule: Map<String, Pair<Int, Int>>
    ): JSONObject {

        val result = JSONObject()

        for (day in days) {
            val period = schedule[day]

            if (period == null) {
                result.put(day, JSONObject.NULL)
            } else {
                result.put(
                    day,
                    JSONObject().apply {
                        put("open", formatTime(period.first))
                        put("close", formatTime(period.second))
                    }
                )
            }
        }

        return result
    }

    /**
     * Export valid breaks only.
     * Exclude private reason/notes.
     *
     * Breaks must fit inside the
     * staff member's working hours.
     */
    private fun exportWeeklyBreaks(
        raw: JSONArray?,
        schedule: Map<String, Pair<Int, Int>>
    ): JSONArray {

        val result = JSONArray()
        if (raw == null) return result

        for (i in 0 until raw.length()) {
            val source = raw.optJSONObject(i)
                ?: continue

            val day = source.optString("day")
                .trim().lowercase(Locale.ROOT)

            val working = schedule[day] ?: continue

            val start = parseTime(
                source.optString("start")
            ) ?: continue

            val end = parseTime(
                source.optString("end")
            ) ?: continue

            if (
                start >= end ||
                start < working.first ||
                end > working.second
            ) {
                continue
            }

            result.put(
                JSONObject().apply {
                    put("day", day)
                    put("start", formatTime(start))
                    put("end", formatTime(end))
                }
            )
        }

        return result
    }

    /**
     * Export date-specific unavailable
     * intervals without private reasons.
     *
     * Date format is YYYY-MM-DD.
     */
    private fun exportTimeOff(
        raw: JSONArray?
    ): JSONArray {

        val result = JSONArray()
        if (raw == null) return result

        for (i in 0 until raw.length()) {
            val source = raw.optJSONObject(i)
                ?: continue

            val date = source.optString("date").trim()

            if (!validDate(date)) continue

            val start = parseTime(
                source.optString("start")
            ) ?: continue

            val end = parseTime(
                source.optString("end")
            ) ?: continue

            if (start >= end) continue

            result.put(
                JSONObject().apply {
                    put("date", date)
                    put("start", formatTime(start))
                    put("end", formatTime(end))
                }
            )
        }

        return result
    }

    private fun validDate(value: String): Boolean {
        if (!Regex("""\d{4}-\d{2}-\d{2}""")
                .matches(value)) {
            return false
        }

        return try {
            java.time.LocalDate.parse(value)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Preserve the existing shared-hours
     * calculation: the overlap of every
     * visible staff member's schedule.
     *
     * These are preview business hours,
     * not available booking slots.
     */
    private fun createWorkingHours(
        rawStaff: JSONArray
    ): JSONObject {

        val weekly = JSONObject()

        val schedules =
            mutableListOf<Map<String, Pair<Int, Int>>>()

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

            schedules.add(staffSchedule(member))
        }

        for (day in days) {
            val intervals = schedules.mapNotNull {
                it[day]
            }

            if (
                schedules.isEmpty() ||
                intervals.size != schedules.size
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
     * Legacy hours formats:
     * Mon-Fri 09:00-17:00
     * Mon-Sat 09:00-18:00
     * Mon 09:00-17:00
     */
    private fun parseStaffHours(
        input: String
    ): Map<String, Pair<Int, Int>> {

        val result =
            mutableMapOf<String, Pair<Int, Int>>()

        val cleaned = input.trim()
            .lowercase(Locale.ROOT)

        val pattern = Regex(
            """^(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?\s+([0-2]\d:[0-5]\d)\s*-\s*([0-2]\d:[0-5]\d)$"""
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
            shortDays.indexOf(match.groupValues[2])
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

    private fun parseTime(value: String): Int? {
        val match = Regex(
            """^([01]\d|2[0-3]):([0-5]\d)$"""
        ).matchEntire(value.trim()) ?: return null

        return match.groupValues[1].toInt() * 60 +
            match.groupValues[2].toInt()
    }

    private fun formatTime(minutes: Int): String {
        return String.format(
            Locale.UK,
            "%02d:%02d",
            minutes / 60,
            minutes % 60
        )
    }
}

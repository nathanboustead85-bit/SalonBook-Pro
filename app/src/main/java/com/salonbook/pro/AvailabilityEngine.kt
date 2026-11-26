package com.salonbook.pro

import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Boustio Phase 8A
 *
 * Read-only appointment availability engine.
 *
 * Uses existing SalonBook Pro JSON records:
 * - services
 * - staff
 * - bookings
 *
 * No Firebase writes.
 * No changes to existing bookings.
 * Does not publish or accept bookings.
 */
object AvailabilityEngine {

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
        "mon", "tue", "wed", "thu",
        "fri", "sat", "sun"
    )

    data class Slot(
        val date: String,
        val time: String,
        val staffId: String,
        val serviceId: String,
        val durationMinutes: Int
    )

    data class AvailabilityResult(
        val available: Boolean,
        val reason: String
    )

    private data class Period(
        val start: Int,
        val end: Int
    )

    /**
     * Generate available appointment slots.
     *
     * slotIntervalMinutes controls the spacing
     * between offered start times.
     *
     * Example: 15 gives 09:00, 09:15, 09:30.
     */
    fun availableSlots(
        date: String,
        staffId: String,
        serviceId: String,
        servicesJson: String,
        staffJson: String,
        bookingsJson: String,
        slotIntervalMinutes: Int = 15
    ): List<Slot> {

        if (
            slotIntervalMinutes !in 1..60 ||
            60 % slotIntervalMinutes != 0
        ) {
            return emptyList()
        }

        val service = findById(
            servicesJson,
            serviceId
        ) ?: return emptyList()

        val staff = findById(
            staffJson,
            staffId
        ) ?: return emptyList()

        val duration = service.optInt(
            "duration", 0
        )

        if (duration !in 1..1440) {
            return emptyList()
        }

        val working = workingPeriod(
            staff, date
        ) ?: return emptyList()

        val results = mutableListOf<Slot>()

        var start = (
            (working.start + slotIntervalMinutes - 1) /
                slotIntervalMinutes
            ) * slotIntervalMinutes

        while (start + duration <= working.end) {

            val time = formatTime(start)

            val check = checkAvailability(
                date = date,
                time = time,
                staffId = staffId,
                serviceId = serviceId,
                servicesJson = servicesJson,
                staffJson = staffJson,
                bookingsJson = bookingsJson
            )

            if (check.available) {
                results.add(
                    Slot(
                        date = date,
                        time = time,
                        staffId = staffId,
                        serviceId = serviceId,
                        durationMinutes = duration
                    )
                )
            }

            start += slotIntervalMinutes
        }

        return results
    }

    /**
     * Check one proposed appointment.
     *
     * This is a read-only validation method.
     * It does not reserve the slot.
     */
    fun checkAvailability(
        date: String,
        time: String,
        staffId: String,
        serviceId: String,
        servicesJson: String,
        staffJson: String,
        bookingsJson: String,
        excludeBookingId: String = ""
    ): AvailabilityResult {

        val day = dayName(date)
            ?: return unavailable("Invalid date")

        val start = parseTime(time)
            ?: return unavailable("Invalid appointment time")

        val service = findById(
            servicesJson, serviceId
        ) ?: return unavailable("Service not found")

        val staff = findById(
            staffJson, staffId
        ) ?: return unavailable("Staff member not found")

        val duration = service.optInt("duration", 0)

        if (duration !in 1..1440) {
            return unavailable("Invalid service duration")
        }

        val end = start + duration

        if (end > 1440) {
            return unavailable("Appointment crosses midnight")
        }

        val assignedServices =
            staff.optJSONArray("serviceIds")
                ?: return unavailable(
                    "Staff services have not been assigned"
                )

        var assigned = false

        for (i in 0 until assignedServices.length()) {
            if (
                assignedServices.optString(i) == serviceId
            ) {
                assigned = true
                break
            }
        }

        if (!assigned) {
            return unavailable(
                "Staff member does not offer this service"
            )
        }

        val working = workingPeriod(
            staff, date
        ) ?: return unavailable(
            "Staff member is not working on $day"
        )

        if (
            start < working.start ||
            end > working.end
        ) {
            return unavailable(
                "Appointment is outside working hours"
            )
        }

        // Recurring breaks.
        val breaks = staff.optJSONArray("weeklyBreaks")

        if (breaks != null) {
            for (i in 0 until breaks.length()) {
                val item = breaks.optJSONObject(i)
                    ?: return unavailable(
                        "Invalid break data"
                    )

                if (
                    item.optString("day")
                        .lowercase(Locale.ROOT) != day
                ) {
                    continue
                }

                val blocked = period(
                    item.optString("start"),
                    item.optString("end")
                ) ?: return unavailable(
                    "Invalid break time"
                )

                if (
                    overlaps(
                        start, end,
                        blocked.start, blocked.end
                    )
                ) {
                    return unavailable(
                        "Staff member is on a break"
                    )
                }
            }
        }

        // Date-specific time off.
        val timeOff = staff.optJSONArray("timeOff")

        if (timeOff != null) {
            for (i in 0 until timeOff.length()) {
                val item = timeOff.optJSONObject(i)
                    ?: return unavailable(
                        "Invalid time-off data"
                    )

                if (item.optString("date") != date) {
                    continue
                }

                val blocked = period(
                    item.optString("start"),
                    item.optString("end")
                ) ?: return unavailable(
                    "Invalid time-off period"
                )

                if (
                    overlaps(
                        start, end,
                        blocked.start, blocked.end
                    )
                ) {
                    return unavailable(
                        "Staff member is unavailable"
                    )
                }
            }
        }

        // Existing saved appointments.
        val bookings = try {
            JSONArray(bookingsJson)
        } catch (_: Exception) {
            return unavailable(
                "Unable to read existing bookings"
            )
        }

        for (i in 0 until bookings.length()) {
            val booking = bookings.optJSONObject(i)
                ?: return unavailable(
                    "Invalid existing booking"
                )

            if (
                excludeBookingId.isNotBlank() &&
                booking.optString("id") ==
                    excludeBookingId
            ) {
                continue
            }

            if (booking.optString("date") != date) {
                continue
            }

            val existingStaffId =
                booking.optString("staffId")

            /*
             * Older bookings may not have a staffId.
             * Treat them conservatively as potential
             * conflicts for every staff member.
             */
            if (
                existingStaffId.isNotBlank() &&
                existingStaffId != staffId
            ) {
                continue
            }

            val bookedStart = parseTime(
                booking.optString("time")
            ) ?: return unavailable(
                "Existing booking has an invalid time"
            )

            var bookedDuration =
                booking.optInt("duration", 0)

            /*
             * Legacy booking fallback:
             * try its saved serviceId first,
             * then its service name.
             */
            if (bookedDuration <= 0) {
                val oldServiceId =
                    booking.optString("serviceId")

                val oldService = if (
                    oldServiceId.isNotBlank()
                ) {
                    findById(
                        servicesJson, oldServiceId
                    )
                } else {
                    findByName(
                        servicesJson,
                        booking.optString("service")
                    )
                }

                bookedDuration =
                    oldService?.optInt("duration", 0)
                        ?: 0
            }

            if (bookedDuration <= 0) {
                return unavailable(
                    "Existing booking duration is unknown"
                )
            }

            val bookedEnd =
                bookedStart + bookedDuration

            if (
                overlaps(
                    start, end,
                    bookedStart, bookedEnd
                )
            ) {
                return unavailable(
                    "This time overlaps an existing booking"
                )
            }
        }

        return AvailabilityResult(
            available = true,
            reason = "Available"
        )
    }

    private fun workingPeriod(
        staff: JSONObject,
        date: String
    ): Period? {

        val day = dayName(date) ?: return null

        val schedule =
            staff.optJSONObject("weeklySchedule")

        if (schedule != null) {
            val item = schedule.optJSONObject(day)
                ?: return null

            return period(
                item.optString("open"),
                item.optString("close")
            )
        }

        // Compatibility with older staff records.
        return legacyWorkingPeriod(
            staff.optString("hours"),
            day
        )
    }

    private fun legacyWorkingPeriod(
        hours: String,
        day: String
    ): Period? {

        val pattern = Regex(
            """^(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$""",
            RegexOption.IGNORE_CASE
        )

        val match = pattern.matchEntire(
            hours.trim()
        ) ?: return null

        val first = shortDays.indexOf(
            match.groupValues[1]
                .lowercase(Locale.ROOT)
        )

        val last = if (
            match.groupValues[2].isBlank()
        ) {
            first
        } else {
            shortDays.indexOf(
                match.groupValues[2]
                    .lowercase(Locale.ROOT)
            )
        }

        val current = days.indexOf(day)

        if (
            first < 0 ||
            last < first ||
            current !in first..last
        ) {
            return null
        }

        return period(
            match.groupValues[3],
            match.groupValues[4]
        )
    }

    private fun period(
        start: String,
        end: String
    ): Period? {

        val a = parseTime(start) ?: return null
        val b = parseTime(end) ?: return null

        if (a >= b) return null

        return Period(a, b)
    }

    private fun overlaps(
        startA: Int,
        endA: Int,
        startB: Int,
        endB: Int
    ): Boolean {
        return startA < endB && endA > startB
    }

    private fun findById(
        json: String,
        id: String
    ): JSONObject? {

        if (id.isBlank()) return null

        val array = try {
            JSONArray(json)
        } catch (_: Exception) {
            return null
        }

        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i)
                ?: continue

            if (item.optString("id") == id) {
                return item
            }
        }

        return null
    }

    private fun findByName(
        json: String,
        name: String
    ): JSONObject? {

        if (name.isBlank()) return null

        val array = try {
            JSONArray(json)
        } catch (_: Exception) {
            return null
        }

        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i)
                ?: continue

            if (
                item.optString("name")
                    .equals(name, ignoreCase = true)
            ) {
                return item
            }
        }

        return null
    }

    private fun dayName(
        date: String
    ): String? {

        val parser = SimpleDateFormat(
            "yyyy-MM-dd",
            Locale.UK
        ).apply {
            isLenient = false
        }

        if (
            !Regex("""^\d{4}-\d{2}-\d{2}$""")
                .matches(date)
        ) {
            return null
        }

        val parsed = try {
            parser.parse(date)
        } catch (_: Exception) {
            null
        } ?: return null

        val calendar = Calendar.getInstance().apply {
            time = parsed
        }

        val index = (
            calendar.get(Calendar.DAY_OF_WEEK) + 5
        ) % 7

        return days[index]
    }

    private fun parseTime(
        value: String
    ): Int? {

        val match = Regex(
            """^([01]\d|2[0-3]):([0-5]\d)$"""
        ).matchEntire(value.trim()) ?: return null

        return match.groupValues[1].toInt() * 60 +
            match.groupValues[2].toInt()
    }

    private fun formatTime(
        minutes: Int
    ): String {

        return String.format(
            Locale.UK,
            "%02d:%02d",
            minutes / 60,
            minutes % 60
        )
    }

    private fun unavailable(
        reason: String
    ): AvailabilityResult {
        return AvailabilityResult(
            available = false,
            reason = reason
        )
    }
}

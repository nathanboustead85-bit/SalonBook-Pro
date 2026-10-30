package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

class MainActivity : Activity() {

    private val purple = Color.rgb(111, 66, 193)
    private val dark = Color.rgb(40, 35, 55)
    private val background = Color.rgb(248, 246, 252)

    private val prefs by lazy {
        getSharedPreferences("salonbook_data", MODE_PRIVATE)
    }

    private val bookings = mutableListOf<Booking>()
    private var selectedDate = today()
    private lateinit var container: LinearLayout

    data class Booking(
        val id: String,
        var client: String,
        var service: String,
        var date: String,
        var time: String,
        var notes: String,
        var serviceId: String = "",
        var staffId: String = "",
        var duration: Int = 0,
        var price: String = ""
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loadBookings()
        showDashboard()
    }

    override fun onResume() {
        super.onResume()
        if (::container.isInitialized) {
            loadBookings()
            showDashboard()
        }
    }

    private fun today(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.UK)
            .format(System.currentTimeMillis())

    private fun readRecords(key: String): List<JSONObject> {
        return try {
            val array = JSONArray(
                prefs.getString(key, "[]") ?: "[]"
            )
            (0 until array.length()).map {
                array.getJSONObject(it)
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun screen(title: String) {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(this@MainActivity.background)
        }

        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 45, 32, 40)
        }

        scroll.addView(container)
        setContentView(scroll)

        container.addView(TextView(this).apply {
            text = title
            textSize = 27f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(purple)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
        })
    }

    private fun text(
        value: String,
        size: Float = 16f
    ) {
        container.addView(TextView(this).apply {
            text = value
            textSize = size
            setTextColor(dark)
            setPadding(8, 12, 8, 12)
        })
    }

    private fun button(
        label: String,
        action: () -> Unit
    ) {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 16f
            setTextColor(Color.WHITE)

            backgroundTintList =
                android.content.res.ColorStateList
                    .valueOf(purple)

            setOnClickListener {
                action()
            }
        }

        container.addView(
            b,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 12
            }
        )
    }

    private fun showDashboard() {
        screen("SalonBook Pro")

        text(
            "Your Beauty Business. Simplified.",
            17f
        )

        text(
            "Today's appointments: " +
                "${bookings.count { it.date == today() }}",
            20f
        )

        text(
            "Upcoming appointments: " +
                "${bookings.count { it.date >= today() }}",
            20f
        )

        text(
            "Total saved bookings: ${bookings.size}",
            18f
        )

        button("View Appointment Calendar") {
            showCalendar()
        }

        button("Create New Booking") {
            bookingDialog()
        }

        button("All Appointments") {
            showAppointments()
        }

        button("Clients") {
            showClients()
        }

        button("Services & Prices") {
            startActivity(
                Intent(
                    this,
                    ManagementActivity::class.java
                ).putExtra("staff", false)
            )
        }

        button("Staff Management") {
            startActivity(
                Intent(
                    this,
                    ManagementActivity::class.java
                ).putExtra("staff", true)
            )
        }

        button("Cloud Account & Backup") {
            startActivity(
                Intent(
                    this,
                    CloudActivity::class.java
                )
            )
        }

        button("My Booking Link") {
            message(
                "Customer online booking links " +
                    "are coming in a future milestone"
            )
        }

        button("Business Settings") {
            message(
                "Business settings are coming next"
            )
        }

        text(
            "SalonBook Pro | Phase 6 - Cloud Sync",
            12f
        )
    }

    private fun showCalendar() {
        screen("Appointment Calendar")

        text(
            "Selected date: $selectedDate",
            19f
        )

        button("Choose Date") {
            pickDate(selectedDate) {
                selectedDate = it
                showCalendar()
            }
        }

        button("Add Booking for This Date") {
            bookingDialog(
                defaultDate = selectedDate
            )
        }

        val daily = bookings.filter {
            it.date == selectedDate
        }.sortedBy {
            it.time
        }

        text(
            "${daily.size} appointments",
            18f
        )

        if (daily.isEmpty()) {
            text("No appointments for this date.")
        }

        daily.forEach {
            bookingCard(it)
        }

        button("Back to Dashboard") {
            showDashboard()
        }
    }

    private fun showAppointments() {
        screen("All Appointments")

        val sorted = bookings.sortedWith(
            compareBy<Booking> {
                it.date
            }.thenBy {
                it.time
            }
        )

        if (sorted.isEmpty()) {
            text("No appointments saved yet.")
        }

        sorted.forEach {
            bookingCard(it)
        }

        button("Create New Booking") {
            bookingDialog()
        }

        button("Back to Dashboard") {
            showDashboard()
        }
    }

    private fun bookingCard(booking: Booking) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(22, 18, 22, 18)
            setBackgroundColor(Color.WHITE)
        }

        val staff = readRecords("staff").firstOrNull {
            it.optString("id") == booking.staffId
        }

        val end = if (booking.duration > 0) {
            "–${formatTime(
                toMinutes(booking.time) + booking.duration
            )}"
        } else {
            ""
        }

        val details = buildString {
            append(
                "${booking.time}$end  •  " +
                    "${booking.client}\n" +
                    "${booking.service}\n" +
                    booking.date
            )

            if (staff != null) {
                append(
                    "\nStaff: ${staff.optString("name")}"
                )
            }

            if (booking.price.isNotBlank()) {
                append(
                    "\nPrice: £${booking.price}"
                )
            }

            if (booking.notes.isNotBlank()) {
                append(
                    "\nNotes: ${booking.notes}"
                )
            }
        }

        card.addView(TextView(this).apply {
            text = details
            textSize = 16f
            setTextColor(dark)
            setPadding(0, 0, 0, 12)
        })

        card.addView(Button(this).apply {
            text = "Edit / Cancel"
            isAllCaps = false

            setOnClickListener {
                bookingOptions(booking)
            }
        })

        container.addView(
            card,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 16
            }
        )
    }

    private fun bookingOptions(booking: Booking) {
        AlertDialog.Builder(this)
            .setTitle(booking.client)
            .setItems(
                arrayOf(
                    "Edit Booking",
                    "Cancel Booking"
                )
            ) { _, which ->
                if (which == 0) {
                    bookingDialog(booking)
                } else {
                    confirmCancel(booking)
                }
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun confirmCancel(booking: Booking) {
        AlertDialog.Builder(this)
            .setTitle("Cancel appointment?")
            .setMessage(
                "Remove ${booking.client}'s " +
                    "appointment on ${booking.date} " +
                    "at ${booking.time}?"
            )
            .setPositiveButton(
                "Cancel Appointment"
            ) { _, _ ->
                bookings.removeAll {
                    it.id == booking.id
                }

                saveBookings()
                showDashboard()
                message("Appointment cancelled")
            }
            .setNegativeButton(
                "Keep Booking",
                null
            )
            .show()
    }

    private fun bookingDialog(
        existing: Booking? = null,
        defaultDate: String = selectedDate
    ) {
        val services = readRecords("services")
        val staff = readRecords("staff")

        if (services.isEmpty() || staff.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Setup required")
                .setMessage(
                    "Add at least one service and " +
                        "one staff member before " +
                        "creating smart bookings."
                )
                .setPositiveButton("OK", null)
                .show()
            return
        }

        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 12, 28, 0)
        }

        fun field(
            hintText: String,
            value: String = ""
        ): EditText = EditText(this).apply {
            hint = hintText
            setSingleLine(true)
            setText(value)
            form.addView(this)
        }

        val client = field(
            "Client name",
            existing?.client ?: ""
        )

        val notes = field(
            "Notes (optional)",
            existing?.notes ?: ""
        )

        val serviceNames = services.map {
            "${it.optString("name")} · " +
                "£${it.optString("price")} · " +
                "${it.optInt("duration")} min"
        }

        val serviceSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                serviceNames
            )

            val index = services.indexOfFirst {
                it.optString("id") == existing?.serviceId
            }

            if (index >= 0) {
                setSelection(index)
            } else if (existing != null) {
                val old = services.indexOfFirst {
                    it.optString("name") == existing.service
                }

                if (old >= 0) {
                    setSelection(old)
                }
            }
        }

        form.addView(TextView(this).apply {
            text = "Service"
            textSize = 16f
        })

        form.addView(serviceSpinner)

        val staffSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                staff.map {
                    "${it.optString("name")} · " +
                        it.optString("role")
                }
            )

            val index = staff.indexOfFirst {
                it.optString("id") == existing?.staffId
            }

            if (index >= 0) {
                setSelection(index)
            }
        }

        form.addView(TextView(this).apply {
            text = "Staff member"
            textSize = 16f
        })

        form.addView(staffSpinner)

        var date = existing?.date ?: defaultDate
        var time = existing?.time ?: "09:00"

        val dateButton = Button(this).apply {
            text = "Date: $date"
            isAllCaps = false
        }

        dateButton.setOnClickListener {
            pickDate(date) {
                date = it
                dateButton.text = "Date: $date"
            }
        }

        form.addView(dateButton)

        val timeButton = Button(this).apply {
            text = "Time: $time"
            isAllCaps = false
        }

        timeButton.setOnClickListener {
            val parts = time.split(":")

            TimePickerDialog(
                this,
                { _, hour, minute ->
                    time = String.format(
                        Locale.UK,
                        "%02d:%02d",
                        hour,
                        minute
                    )
                    timeButton.text = "Time: $time"
                },
                parts[0].toInt(),
                parts[1].toInt(),
                true
            ).show()
        }

        form.addView(timeButton)

        val scroll = ScrollView(this).apply {
            addView(form)
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(
                if (existing == null) {
                    "New Booking"
                } else {
                    "Edit Booking"
                }
            )
            .setView(scroll)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
            ).setOnClickListener {

                val name = client.text.toString().trim()

                if (name.isBlank()) {
                    message("Enter a client name")
                    return@setOnClickListener
                }

                val service = services[
                    serviceSpinner.selectedItemPosition
                ]

                val member = staff[
                    staffSpinner.selectedItemPosition
                ]

                val duration =
                    service.optInt("duration", 0)

                if (duration <= 0) {
                    message(
                        "Service duration must be positive"
                    )
                    return@setOnClickListener
                }

                val start = toMinutes(time)

                if (start + duration > 1440) {
                    message(
                        "Appointment cannot finish after midnight"
                    )
                    return@setOnClickListener
                }

                val staffId = member.optString("id")

                val conflict = bookings.any { other ->
                    other.id != existing?.id &&
                        other.date == date &&
                        other.staffId == staffId &&
                        other.duration > 0 &&
                        start <
                            toMinutes(other.time) +
                            other.duration &&
                        toMinutes(other.time) <
                            start + duration
                }

                if (conflict) {
                    message(
                        "This staff member already " +
                            "has an overlapping booking"
                    )
                    return@setOnClickListener
                }

                val hours = member.optString("hours")

                if (!withinWorkingHours(
                        hours,
                        date,
                        start,
                        start + duration
                    )
                ) {
                    message(
                        "Outside staff working hours. " +
                            "Use e.g. Mon-Fri 09:00-17:00"
                    )
                    return@setOnClickListener
                }

                val booking = existing ?: Booking(
                    UUID.randomUUID().toString(),
                    "",
                    "",
                    "",
                    "",
                    ""
                )

                booking.client = name
                booking.service = service.optString("name")
                booking.serviceId = service.optString("id")
                booking.staffId = staffId
                booking.duration = duration
                booking.price = service.optString("price")
                booking.date = date
                booking.time = time
                booking.notes = notes.text.toString().trim()

                if (existing == null) {
                    bookings.add(booking)
                }

                saveBookings()
                selectedDate = date
                dialog.dismiss()
                showCalendar()
                message("Booking saved")
            }
        }

        dialog.show()
    }

    private fun toMinutes(time: String): Int {
        val parts = time.split(":")
        return parts[0].toInt() * 60 +
            parts[1].toInt()
    }

    private fun formatTime(minutes: Int): String =
        String.format(
            Locale.UK,
            "%02d:%02d",
            minutes / 60,
            minutes % 60
        )

    private fun withinWorkingHours(
        hours: String,
        date: String,
        start: Int,
        end: Int
    ): Boolean {

        val pattern = Regex(
            "^(?:(.+?)\\s+)?(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})$",
            RegexOption.IGNORE_CASE
        )

        val match = pattern.matchEntire(
            hours.trim()
        ) ?: return false

        val from = runCatching {
            toMinutes(match.groupValues[2])
        }.getOrNull() ?: return false

        val until = runCatching {
            toMinutes(match.groupValues[3])
        }.getOrNull() ?: return false

        if (
            from !in 0..1439 ||
            until !in 1..1440 ||
            from >= until
        ) {
            return false
        }

        val days = match.groupValues[1].trim()

        if (days.isNotEmpty()) {
            val parsed = runCatching {
                SimpleDateFormat(
                    "yyyy-MM-dd",
                    Locale.UK
                ).apply {
                    isLenient = false
                }.parse(date)
            }.getOrNull() ?: return false

            val calendar = Calendar.getInstance().apply {
                time = parsed
            }

            val current = (
                calendar.get(Calendar.DAY_OF_WEEK) + 5
            ) % 7

            val names = listOf(
                "mon",
                "tue",
                "wed",
                "thu",
                "fri",
                "sat",
                "sun"
            )

            val allowed = mutableSetOf<Int>()

            for (
                part in days
                    .lowercase(Locale.UK)
                    .split(",")
            ) {
                val bounds = part.trim().split("-")

                if (bounds.size !in 1..2) {
                    return false
                }

                val first = names.indexOf(
                    bounds[0].trim().take(3)
                )

                if (first < 0) {
                    return false
                }

                if (bounds.size == 1) {
                    allowed.add(first)
                } else {
                    val last = names.indexOf(
                        bounds[1].trim().take(3)
                    )

                    if (last < 0) {
                        return false
                    }

                    var day = first

                    for (step in 0..6) {
                        allowed.add(day)

                        if (day == last) {
                            break
                        }

                        day = (day + 1) % 7
                    }
                }
            }

            if (current !in allowed) {
                return false
            }
        }

        return start >= from && end <= until
    }

    private fun pickDate(
        current: String,
        onPicked: (String) -> Unit
    ) {
        val parts = current.split("-")

        DatePickerDialog(
            this,
            { _, year, month, day ->
                onPicked(
                    String.format(
                        Locale.UK,
                        "%04d-%02d-%02d",
                        year,
                        month + 1,
                        day
                    )
                )
            },
            parts[0].toInt(),
            parts[1].toInt() - 1,
            parts[2].toInt()
        ).show()
    }

    private fun showClients() {
        screen("Clients")

        val clients = bookings.map {
            it.client
        }.distinct().sorted()

        text(
            "${clients.size} clients",
            18f
        )

        if (clients.isEmpty()) {
            text(
                "Clients appear here after " +
                    "bookings are added."
            )
        }

        clients.forEach { name ->
            text(
                "$name — " +
                    "${bookings.count {
                        it.client == name
                    }} booking(s)"
            )
        }

        button("Back to Dashboard") {
            showDashboard()
        }
    }

    private fun saveBookings() {
        val array = JSONArray()

        bookings.forEach { booking ->
            array.put(
                JSONObject().apply {
                    put("id", booking.id)
                    put("client", booking.client)
                    put("service", booking.service)
                    put("date", booking.date)
                    put("time", booking.time)
                    put("notes", booking.notes)
                    put("serviceId", booking.serviceId)
                    put("staffId", booking.staffId)
                    put("duration", booking.duration)
                    put("price", booking.price)
                }
            )
        }

        prefs.edit()
            .putString(
                "bookings",
                array.toString()
            )
            .apply()
    }

    private fun loadBookings() {
        bookings.clear()

        try {
            val array = JSONArray(
                prefs.getString(
                    "bookings",
                    "[]"
                ) ?: "[]"
            )

            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)

                bookings.add(
                    Booking(
                        item.optString("id"),
                        item.optString("client"),
                        item.optString("service"),
                        item.optString("date"),
                        item.optString("time"),
                        item.optString("notes"),
                        item.optString("serviceId"),
                        item.optString("staffId"),
                        item.optInt("duration", 0),
                        item.optString("price")
                    )
                )
            }
        } catch (_: Exception) {
            message("Could not load saved bookings")
        }
    }

    private fun message(value: String) {
        Toast.makeText(
            this,
            value,
            Toast.LENGTH_SHORT
        ).show()
    }
}

package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

class MainActivity : Activity() {
    private val orange = Color.rgb(242, 110, 36)
    private val dark = Color.rgb(32, 36, 43)
    private val background = Color.rgb(250, 249, 247)
    private val muted = Color.rgb(110, 114, 120)
    private val paleOrange = Color.rgb(255, 239, 228)
    private val prefs by lazy { getSharedPreferences("salonbook_data", MODE_PRIVATE) }
    private val bookings = mutableListOf<Booking>()
    private var selectedDate = today()
    private lateinit var container: LinearLayout
    private var currentScreen = "dashboard"

    data class Booking(
        val id: String, var client: String, var service: String,
        var date: String, var time: String, var notes: String,
        var serviceId: String = "", var staffId: String = "",
        var duration: Int = 0, var price: String = ""
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        selectedDate = savedInstanceState?.getString("selectedDate") ?: today()
        loadBookings()
        showDashboard()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("selectedDate", selectedDate)
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        if (::container.isInitialized) {
            loadBookings()
            when (currentScreen) {
                "calendar" -> showCalendar()
                "appointments" -> showAppointments()
                "clients" -> showClients()
                "availability" -> showAvailabilityTester()
                else -> showDashboard()
            }
        }
    }

    private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.UK)
        .format(System.currentTimeMillis())
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun rounded(colour: Int, radius: Int = 18) = GradientDrawable().apply {
        setColor(colour)
        cornerRadius = dp(radius).toFloat()
    }
    private fun label(value: String, size: Float = 16f, colour: Int = dark, bold: Boolean = false) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(colour)
            if (bold) typeface = Typeface.DEFAULT_BOLD
        }
    private fun styleButton(button: Button, filled: Boolean = true) {
        button.isAllCaps = false
        button.textSize = 15f
        button.setTextColor(if (filled) Color.WHITE else orange)
        button.backgroundTintList = ColorStateList.valueOf(if (filled) orange else paleOrange)
    }
    private fun readRecords(key: String): List<JSONObject> = try {
        val array = JSONArray(prefs.getString(key, "[]") ?: "[]")
        (0 until array.length()).map { array.getJSONObject(it) }
    } catch (_: Exception) { emptyList() }

    private fun screen(title: String, subtitle: String = "", mode: String = "other") {
        currentScreen = mode
        window.statusBarColor = background
        window.navigationBarColor = background
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
            View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        val scroll = ScrollView(this).apply {
            setBackgroundColor(this@MainActivity.background)
            isFillViewport = true
        }
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(22), dp(18), dp(32))
        }
        scroll.addView(container)
        setContentView(scroll)
        container.addView(label("BOUSTIO", 14f, orange, true))
        container.addView(label(title, 29f, dark, true), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(12)
        })
        if (subtitle.isNotBlank()) {
            container.addView(label(subtitle, 15f, muted), LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = dp(8)
                bottomMargin = dp(14)
            })
        }
    }

    private fun text(value: String, size: Float = 16f) {
        container.addView(label(value, size), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(10)
            bottomMargin = dp(10)
        })
    }
    private fun button(value: String, action: () -> Unit) {
        container.addView(Button(this).apply {
            text = value
            styleButton(this)
            setOnClickListener { action() }
        }, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) })
    }
    private fun section(value: String) {
        container.addView(label(value.uppercase(Locale.UK), 12f, muted, true),
            LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = dp(22)
                bottomMargin = dp(12)
            })
    }
    private fun panel(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(18), dp(18), dp(18), dp(18))
        background = rounded(Color.WHITE)
        elevation = dp(2).toFloat()
    }
    private fun addPanel(panel: LinearLayout) {
        container.addView(panel, LinearLayout.LayoutParams(-1, -2).apply {
            bottomMargin = dp(14)
        })
    }
    private fun dashboardCard(title: String, count: String) {
        val card = panel()
        card.addView(label(title, 14f, muted))
        card.addView(label(count, 30f, dark, true))
        addPanel(card)
    }

    private fun showDashboard() {
        screen("Your Dashboard", "Your business. Beautifully organised.", "dashboard")
        section("Today's overview")
        dashboardCard("Appointments today", bookings.count { it.date == today() }.toString())
        dashboardCard("Upcoming appointments", bookings.count { it.date >= today() }.toString())
        dashboardCard("Total saved bookings", bookings.size.toString())
        section("Quick actions")
        button("+ New Appointment") { bookingDialog() }
        button("Appointment Calendar") { showCalendar() }
        button("All Appointments") { showAppointments() }
        section("Manage your business")
        button("Clients") { showClients() }
        button("Services & Prices") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        button("Staff & Working Hours") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        button("My Boustio Booking Link") {
            startActivity(Intent(this, BusinessProfileActivity::class.java))
        }
        section("Account & tools")
        button("Cloud Account & Backup") {
            startActivity(Intent(this, CloudActivity::class.java))
        }
        button("Test Appointment Availability") { showAvailabilityTester() }
        text("BOUSTIO  •  Phase 9A.4", 12f)
    }

    private fun shiftDate(date: String, days: Int): String {
        val parser = SimpleDateFormat("yyyy-MM-dd", Locale.UK).apply { isLenient = false }
        val calendar = Calendar.getInstance().apply { time = parser.parse(date)!! }
        calendar.add(Calendar.DAY_OF_MONTH, days)
        return parser.format(calendar.time)
    }
    private fun displayDate(date: String): String = runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd", Locale.UK).apply { isLenient = false }
        SimpleDateFormat("EEEE d MMMM yyyy", Locale.UK).format(parser.parse(date)!!)
    }.getOrDefault(date)
    private fun dayPart(date: String, pattern: String): String = runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd", Locale.UK)
        SimpleDateFormat(pattern, Locale.UK).format(parser.parse(date)!!)
    }.getOrDefault(date)

    private fun showCalendar() {
        screen("Appointment Calendar", "Your daily schedule at a glance.", "calendar")
        val navigation = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val previous = Button(this).apply {
            text = "‹"
            styleButton(this, false)
            setOnClickListener { selectedDate = shiftDate(selectedDate, -1); showCalendar() }
        }
        val dateTitle = label(displayDate(selectedDate), 17f, dark, true).apply {
            gravity = Gravity.CENTER
            setOnClickListener { pickDate(selectedDate) { selectedDate = it; showCalendar() } }
        }
        val next = Button(this).apply {
            text = "›"
            styleButton(this, false)
            setOnClickListener { selectedDate = shiftDate(selectedDate, 1); showCalendar() }
        }
        navigation.addView(previous, LinearLayout.LayoutParams(dp(56), -2))
        navigation.addView(dateTitle, LinearLayout.LayoutParams(0, -2, 1f))
        navigation.addView(next, LinearLayout.LayoutParams(dp(56), -2))
        container.addView(navigation)

        val week = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for (offset in -3..3) {
            val date = shiftDate(selectedDate, offset)
            val selected = offset == 0
            val cell = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(dp(2), dp(10), dp(2), dp(10))
                background = rounded(if (selected) orange else Color.WHITE, 12)
                setOnClickListener { selectedDate = date; showCalendar() }
            }
            cell.addView(label(dayPart(date, "EEE"), 11f,
                if (selected) Color.WHITE else muted, true).apply { gravity = Gravity.CENTER })
            cell.addView(label(dayPart(date, "d"), 18f,
                if (selected) Color.WHITE else dark, true).apply { gravity = Gravity.CENTER })
            week.addView(cell, LinearLayout.LayoutParams(0, -2, 1f).apply {
                marginStart = dp(2)
                marginEnd = dp(2)
            })
        }
        container.addView(week, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(14)
            bottomMargin = dp(16)
        })
        button("Choose Another Date") {
            pickDate(selectedDate) { selectedDate = it; showCalendar() }
        }
        button("+ Add Appointment") { bookingDialog(defaultDate = selectedDate) }
        val daily = bookings.filter { it.date == selectedDate }.sortedBy { it.time }
        val summary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = rounded(orange)
        }
        summary.addView(label("DAILY OVERVIEW", 13f, Color.WHITE, true))
        summary.addView(label("${daily.size} appointment${if (daily.size == 1) "" else "s"}",
            26f, Color.WHITE, true))
        summary.addView(label(displayDate(selectedDate), 14f, Color.WHITE))
        container.addView(summary, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(6)
            bottomMargin = dp(12)
        })
        section("Daily schedule")
        if (daily.isEmpty()) {
            val empty = panel()
            empty.addView(label("No appointments scheduled", 19f, dark, true))
            empty.addView(label("This date is free. Add an appointment to get started.", 14f, muted))
            addPanel(empty)
        } else daily.forEach { bookingCard(it) }
        button("Today") { selectedDate = today(); showCalendar() }
        button("Back to Dashboard") { showDashboard() }
    }

    private fun showAppointments() {
        screen("All Appointments", "Every booking, in date and time order.", "appointments")
        val sorted = bookings.sortedWith(compareBy<Booking> { it.date }.thenBy { it.time })
        if (sorted.isEmpty()) text("No appointments saved yet.")
        sorted.forEach { bookingCard(it) }
        button("Create New Booking") { bookingDialog() }
        button("Back to Dashboard") { showDashboard() }
    }

    private fun bookingCard(booking: Booking) {
        val card = panel()
        val staff = readRecords("staff").firstOrNull { it.optString("id") == booking.staffId }
        val end = if (booking.duration > 0) {
            runCatching { " – ${formatTime(toMinutes(booking.time) + booking.duration)}" }
                .getOrDefault("")
        } else ""
        card.addView(label("${booking.time}$end", 15f, orange, true))
        card.addView(label(booking.client, 21f, dark, true), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8)
        })
        card.addView(label(booking.service, 16f, dark))
        card.addView(label(displayDate(booking.date), 13f, muted),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
        if (staff != null) card.addView(label("Staff: ${staff.optString("name")}", 14f, muted))
        if (booking.duration > 0) card.addView(label("Duration: ${booking.duration} minutes", 14f, muted))
        if (booking.price.isNotBlank()) card.addView(label("£${booking.price}", 20f, orange, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
        if (booking.notes.isNotBlank()) card.addView(label("Notes: ${booking.notes}", 14f, muted))
        card.addView(Button(this).apply {
            text = "Edit / Cancel"
            styleButton(this)
            setOnClickListener { bookingOptions(booking) }
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        addPanel(card)
    }

    private fun bookingOptions(booking: Booking) {
        AlertDialog.Builder(this).setTitle(booking.client)
            .setItems(arrayOf("Edit Booking", "Cancel Booking")) { _, choice ->
                if (choice == 0) bookingDialog(booking) else confirmCancel(booking)
            }.setNegativeButton("Close", null).show()
    }
    private fun confirmCancel(booking: Booking) {
        AlertDialog.Builder(this).setTitle("Cancel appointment?")
            .setMessage("Remove ${booking.client}'s appointment on ${booking.date} at ${booking.time}?")
            .setPositiveButton("Cancel Appointment") { _, _ ->
                bookings.removeAll { it.id == booking.id }
                saveBookings()
                selectedDate = booking.date
                showCalendar()
                message("Appointment cancelled")
            }.setNegativeButton("Keep Booking", null).show()
    }

    private fun bookingDialog(existing: Booking? = null, defaultDate: String = selectedDate) {
        val services = readRecords("services")
        val staff = readRecords("staff")
        if (services.isEmpty() || staff.isEmpty()) {
            AlertDialog.Builder(this).setTitle("Setup required")
                .setMessage("Add at least one service and one staff member before creating smart bookings.")
                .setPositiveButton("OK", null).show()
            return
        }
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(12), dp(24), dp(8))
        }
        fun field(hintText: String, value: String = ""): EditText = EditText(this).apply {
            hint = hintText
            setSingleLine(true)
            setText(value)
            setTextColor(dark)
            backgroundTintList = ColorStateList.valueOf(orange)
            form.addView(this)
        }
        val client = field("Client name", existing?.client ?: "")
        val notes = field("Notes (optional)", existing?.notes ?: "")
        val serviceSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item,
                services.map { "${it.optString("name")} · £${it.optString("price")} · ${it.optInt("duration")} min" })
            val index = services.indexOfFirst { it.optString("id") == existing?.serviceId }
            if (index >= 0) setSelection(index)
            else if (existing != null) {
                val old = services.indexOfFirst { it.optString("name") == existing.service }
                if (old >= 0) setSelection(old)
            }
        }
        form.addView(label("Service", 16f, dark, true))
        form.addView(serviceSpinner)
        val staffSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item,
                staff.map { "${it.optString("name")} · ${it.optString("role")}" })
            val index = staff.indexOfFirst { it.optString("id") == existing?.staffId }
            if (index >= 0) setSelection(index)
        }
        form.addView(label("Staff member", 16f, dark, true))
        form.addView(staffSpinner)
        var date = existing?.date ?: defaultDate
        var time = existing?.time ?: "09:00"
        val dateButton = Button(this).apply { text = "Date: $date"; styleButton(this, false) }
        dateButton.setOnClickListener {
            pickDate(date) { date = it; dateButton.text = "Date: $date" }
        }
        form.addView(dateButton)
        val timeButton = Button(this).apply { text = "Time: $time"; styleButton(this, false) }
        timeButton.setOnClickListener {
            val parts = time.split(":")
            TimePickerDialog(this, { _, hour, minute ->
                time = String.format(Locale.UK, "%02d:%02d", hour, minute)
                timeButton.text = "Time: $time"
            }, parts[0].toInt(), parts[1].toInt(), true).show()
        }
        form.addView(timeButton)
        val dialog = AlertDialog.Builder(this)
            .setTitle(if (existing == null) "New Booking" else "Edit Booking")
            .setView(ScrollView(this).apply { addView(form) })
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val name = client.text.toString().trim()
                if (name.isBlank()) { message("Enter a client name"); return@setOnClickListener }
                val service = services[serviceSpinner.selectedItemPosition]
                val member = staff[staffSpinner.selectedItemPosition]
                val duration = service.optInt("duration", 0)
                if (duration <= 0) { message("Service duration must be positive"); return@setOnClickListener }
                val start = toMinutes(time)
                if (start + duration > 1440) {
                    message("Appointment cannot finish after midnight")
                    return@setOnClickListener
                }
                val staffId = member.optString("id")
                val conflict = bookings.any { other ->
                    other.id != existing?.id && other.date == date &&
                        other.staffId == staffId && other.duration > 0 &&
                        start < toMinutes(other.time) + other.duration &&
                        toMinutes(other.time) < start + duration
                }
                if (conflict) {
                    message("This staff member already has an overlapping booking")
                    return@setOnClickListener
                }
                val hours = member.optString("hours")
                if (!withinWorkingHours(hours, date, start, start + duration)) {
                    message("Outside staff working hours. Use e.g. Mon-Fri 09:00-17:00")
                    return@setOnClickListener
                }
                val booking = existing ?: Booking(UUID.randomUUID().toString(), "", "", "", "", "")
                booking.client = name
                booking.service = service.optString("name")
                booking.serviceId = service.optString("id")
                booking.staffId = staffId
                booking.duration = duration
                booking.price = service.optString("price")
                booking.date = date
                booking.time = time
                booking.notes = notes.text.toString().trim()
                if (existing == null) bookings.add(booking)
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
        return parts[0].toInt() * 60 + parts[1].toInt()
    }
    private fun formatTime(minutes: Int): String =
        String.format(Locale.UK, "%02d:%02d", minutes / 60, minutes % 60)

    private fun withinWorkingHours(hours: String, date: String, start: Int, end: Int): Boolean {
        val pattern = Regex("^(?:(.+?)\\s+)?(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})$",
            RegexOption.IGNORE_CASE)
        val match = pattern.matchEntire(hours.trim()) ?: return false
        val from = runCatching { toMinutes(match.groupValues[2]) }.getOrNull() ?: return false
        val until = runCatching { toMinutes(match.groupValues[3]) }.getOrNull() ?: return false
        if (from !in 0..1439 || until !in 1..1440 || from >= until) return false
        val days = match.groupValues[1].trim()
        if (days.isNotEmpty()) {
            val parsed = runCatching {
                SimpleDateFormat("yyyy-MM-dd", Locale.UK).apply { isLenient = false }.parse(date)
            }.getOrNull() ?: return false
            val calendar = Calendar.getInstance().apply { time = parsed }
            val current = (calendar.get(Calendar.DAY_OF_WEEK) + 5) % 7
            val names = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
            val allowed = mutableSetOf<Int>()
            for (part in days.lowercase(Locale.UK).split(",")) {
                val bounds = part.trim().split("-")
                if (bounds.size !in 1..2) return false
                val first = names.indexOf(bounds[0].trim().take(3))
                if (first < 0) return false
                if (bounds.size == 1) allowed.add(first)
                else {
                    val last = names.indexOf(bounds[1].trim().take(3))
                    if (last < 0) return false
                    var day = first
                    for (step in 0..6) {
                        allowed.add(day)
                        if (day == last) break
                        day = (day + 1) % 7
                    }
                }
            }
            if (current !in allowed) return false
        }
        return start >= from && end <= until
    }

    private fun pickDate(current: String, onPicked: (String) -> Unit) {
        val parts = current.split("-")
        DatePickerDialog(this, { _, year, month, day ->
            onPicked(String.format(Locale.UK, "%04d-%02d-%02d", year, month + 1, day))
        }, parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt()).show()
    }

    private fun showClients() {
        screen("Clients", "Your appointment clients.", "clients")
        val clients = bookings.map { it.client }.distinct().sorted()
        text("${clients.size} clients", 18f)
        if (clients.isEmpty()) text("Clients appear here after bookings are added.")
        clients.forEach { name ->
            val card = panel()
            card.addView(label(name, 18f, dark, true))
            card.addView(label("${bookings.count { it.client == name }} booking(s)", 14f, muted))
            addPanel(card)
        }
        button("Back to Dashboard") { showDashboard() }
    }

    private fun showAvailabilityTester(testDate: String = selectedDate) {
        screen("Appointment Availability Test", "Private testing only — no bookings are created.", "availability")
        val services = readRecords("services")
        val staff = readRecords("staff")
        if (services.isEmpty() || staff.isEmpty()) {
            text("Add at least one service and one staff member before testing.")
            button("Back to Dashboard") { showDashboard() }
            return
        }
        text("Select service", 18f)
        val serviceSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item,
                services.map { "${it.optString("name")} (${it.optInt("duration")} min)" })
        }
        container.addView(serviceSpinner)
        text("Select staff member", 18f)
        val staffSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item,
                staff.map { it.optString("name") })
        }
        container.addView(staffSpinner)
        var date = testDate
        val dateButton = Button(this).apply { text = "Date: $date"; styleButton(this, false) }
        dateButton.setOnClickListener { pickDate(date) { date = it; dateButton.text = "Date: $date" } }
        container.addView(dateButton)
        button("Check Available Times") {
            val service = services[serviceSpinner.selectedItemPosition]
            val member = staff[staffSpinner.selectedItemPosition]
            val slots = AvailabilityEngine.availableSlots(
                date = date,
                staffId = member.optString("id"),
                serviceId = service.optString("id"),
                servicesJson = prefs.getString("services", "[]") ?: "[]",
                staffJson = prefs.getString("staff", "[]") ?: "[]",
                bookingsJson = prefs.getString("bookings", "[]") ?: "[]",
                slotIntervalMinutes = 15
            )
            screen("Availability Results", "Private test results.", "availability")
            text("Staff: ${member.optString("name")}\nService: ${service.optString("name")}\n" +
                "Date: $date\nDuration: ${service.optInt("duration")} minutes", 17f)
            text("Available appointment starts: ${slots.size}", 20f)
            if (slots.isEmpty()) text("No available times found. This could be due to working hours, " +
                "breaks, time off, existing bookings or missing staff service assignments.")
            else slots.forEach { slot -> text("Available: ${slot.time}", 16f) }
            button("Test Another Date") { showAvailabilityTester(date) }
            button("Back to Dashboard") { showDashboard() }
        }
        button("Back to Dashboard") { showDashboard() }
    }

    private fun saveBookings() {
        val array = JSONArray()
        bookings.forEach { booking ->
            array.put(JSONObject().apply {
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
            })
        }
        val json = array.toString()
        prefs.edit().putString("bookings", json).apply()
        if (FirebaseAuth.getInstance().currentUser?.isEmailVerified == true) {
            CloudSyncManager().upload("bookings", json) { result ->
                result.exceptionOrNull()?.let { error ->
                    runOnUiThread {
                        if (!isFinishing && !isDestroyed) {
                            message("Cloud sync failed: ${error.localizedMessage ?: "Unknown error"}")
                        }
                    }
                }
            }
        }
    }

    private fun loadBookings() {
        bookings.clear()
        try {
            val array = JSONArray(prefs.getString("bookings", "[]") ?: "[]")
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                bookings.add(Booking(
                    item.optString("id"), item.optString("client"),
                    item.optString("service"), item.optString("date"),
                    item.optString("time"), item.optString("notes"),
                    item.optString("serviceId"), item.optString("staffId"),
                    item.optInt("duration", 0), item.optString("price")
                ))
            }
        } catch (_: Exception) { message("Could not load saved bookings") }
    }
    private fun message(value: String) {
        Toast.makeText(this, value, Toast.LENGTH_SHORT).show()
    }

}

package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.os.Build
import android.view.ViewGroup
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

class MainActivity : Activity() {

    private val purple = Color.rgb(0, 139, 131)
    private val dark = Color.rgb(20, 49, 52)
    private val background = Color.rgb(244, 250, 249)

    private val prefs by lazy {
        getSharedPreferences("salonbook_data", MODE_PRIVATE)
    }

    private val bookings = mutableListOf<Booking>()
    private var selectedDate = today()
    private lateinit var container: LinearLayout
    private var activeTab = "Home"
    private val muted = Color.rgb(108, 120, 117)
    private val mint = Color.rgb(231, 244, 239)

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

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun screen(title: String) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(249, 250, 248))
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = false
        }
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(30))
        }
        scroll.addView(container)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(bottomNavigation())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener { view, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                view.setPadding(0, bars.top, 0, bars.bottom)
                insets
            }
        } else {
            root.fitsSystemWindows = true
        }
        window.navigationBarColor = Color.WHITE
        window.statusBarColor = Color.rgb(249, 250, 248)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        setContentView(root)

        val brand = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(25))
        }
        brand.addView(ImageView(this).apply {
            setImageResource(R.drawable.boustio_mark)
            contentDescription = "Boustio brand mark"
            scaleType = ImageView.ScaleType.FIT_CENTER
        }, LinearLayout.LayoutParams(dp(52), dp(52)))
        val brandText = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), 0, 0, 0)
        }
        brandText.addView(dashboardLabel("Boustio", 25f, true))
        brandText.addView(TextView(this).apply {
            text = "A booking platform with a difference"
            textSize = 11f
            setTextColor(Color.rgb(17, 106, 96))
        })
        brand.addView(brandText)
        container.addView(brand)
        container.addView(TextView(this).apply {
            text = title
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(dark)
            setPadding(0, 0, 0, dp(8))
        })
    }

    private fun bottomNavigation(): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.WHITE)
            setPadding(dp(9), dp(8), dp(9), dp(8))
            elevation = dp(8).toFloat()
            listOf(
                Triple(R.drawable.nav_home, "Home", { showDashboard() }),
                Triple(R.drawable.nav_calendar, "Calendar", { showCalendar() }),
                Triple(R.drawable.nav_clients, "Clients", { showClients() }),
                Triple(R.drawable.nav_settings, "Settings", { showBusinessSettings() })
            ).forEach { (symbol, label, action) ->
                val selected = activeTab == label
                val item = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    background = rounded(if (selected) mint else Color.WHITE, dp(15).toFloat())
                    setPadding(0, dp(6), 0, dp(6))
                    isClickable = true
                    isFocusable = true
                    contentDescription = label
                    setOnClickListener { action() }
                }
                item.addView(ImageView(this@MainActivity).apply {
                    setImageResource(symbol)
                    setColorFilter(if (selected) purple else muted)
                    contentDescription = null
                }, LinearLayout.LayoutParams(dp(25), dp(25)))
                item.addView(TextView(this@MainActivity).apply {
                    text = label
                    textSize = 11f
                    gravity = Gravity.CENTER
                    typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                    setTextColor(if (selected) purple else muted)
                })
                addView(item, LinearLayout.LayoutParams(0, dp(60), 1f))
            }
        }

    private fun sectionLabel(label: String) {
        container.addView(TextView(this).apply {
            text = label.uppercase(Locale.UK)
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(muted)
        }, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(26)
            bottomMargin = dp(10)
        })
    }

    private fun premiumCard(
        symbol: String, title: String, description: String, action: () -> Unit
    ) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(15), dp(16), dp(14), dp(16))
            background = rounded(Color.WHITE, dp(20).toFloat())
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = title
            setOnClickListener { action() }
        }
        card.addView(TextView(this).apply {
            text = symbol
            textSize = 25f
            gravity = Gravity.CENTER
            background = rounded(mint, dp(14).toFloat())
        }, LinearLayout.LayoutParams(dp(54), dp(54)))
        val labels = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(15), 0, dp(6), 0)
        }
        labels.addView(dashboardLabel(title, 16f, true))
        labels.addView(TextView(this).apply {
            text = description
            textSize = 12f
            setTextColor(muted)
        })
        card.addView(labels, LinearLayout.LayoutParams(0, -2, 1f))
        card.addView(TextView(this).apply {
            text = "›"
            textSize = 28f
            setTextColor(purple)
        })
        container.addView(card, LinearLayout.LayoutParams(-1, -2).apply {
            bottomMargin = dp(14)
        })
    }

    private fun showBusinessSettings() {
        activeTab = "Settings"
        screen("Business settings")
        container.addView(TextView(this).apply {
            text = "Make Boustio work beautifully for your business."
            textSize = 17f
            setTextColor(muted)
            setPadding(0, 0, 0, dp(20))
        })
        val introduction = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(20))
            background = rounded(Color.WHITE, dp(22).toFloat())
            elevation = dp(2).toFloat()
        }
        introduction.addView(TextView(this).apply {
            text = "YOUR BUSINESS • BOUSTIO"
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(purple)
        })
        introduction.addView(dashboardLabel("Everything in its place", 21f, true))
        introduction.addView(TextView(this).apply {
            text = "Manage your services, team, booking link and account from one place."
            textSize = 14f
            setTextColor(muted)
        })
        container.addView(introduction)
        sectionLabel("Business management")
        premiumCard("▤", "Services & Prices", "Manage your service catalogue") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        premiumCard("♟", "Staff & Working Hours", "Manage your team and availability") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        premiumCard("🔗", "My Boustio Booking Link", "Public booking profile • not connected") {
            message("Booking link is not connected in this test build.")
        }
        premiumCard("☏", "Customer Messages", "Private chat inbox • preview only") {
            message("Customer messaging is not enabled in this test build.")
        }
        sectionLabel("Account and tools")
        premiumCard("☁", "Cloud Account & Backup", "Cloud account, backup and restore") {
            startActivity(Intent(this, CloudActivity::class.java))
        }
        premiumCard("▦", "Test Appointment Availability", "Check booking slots") {
            showCalendar()
        }
        sectionLabel("Appointments")
        premiumCard("▣", "All Appointments", "Browse and manage every booking") {
            showAppointments()
        }
        container.addView(dashboardLabel("BOUSTIO • A BOOKING PLATFORM WITH A DIFFERENCE", 10f))
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

    private fun rounded(fill: Int, radius: Float = 22f): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius
        }

    private fun button(label: String, action: () -> Unit) {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = rounded(purple, 24f)
            elevation = 3f
            setPadding(16, 14, 16, 14)
            setOnClickListener { action() }
        }
        container.addView(b, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 14 })
    }

    private fun dashboardLabel(value: String, size: Float = 15f, strong: Boolean = false) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(dark)
            if (strong) typeface = Typeface.DEFAULT_BOLD
            setPadding(8, 5, 8, 5)
        }

    private fun dashboardStat(label: String, count: Int): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(Color.WHITE)
            setPadding(18, 18, 18, 18)
            elevation = 2f
            addView(dashboardLabel(count.toString(), 27f, true))
            addView(dashboardLabel(label, 12f))
        }

    private fun showDashboard() {
        activeTab = "Home"
        screen("Dashboard")
        container.addView(dashboardLabel("A booking platform with a difference.", 14f))
        container.addView(dashboardLabel("Your business at a glance", 21f, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = 24; bottomMargin = 12 })

        val stats = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            weightSum = 3f
        }
        listOf(
            dashboardStat("Today", bookings.count { it.date == today() }),
            dashboardStat("Upcoming", bookings.count { it.date >= today() }),
            dashboardStat("Total bookings", bookings.size)
        ).forEach { stat ->
            stats.addView(stat, LinearLayout.LayoutParams(0, -2, 1f).apply {
                marginEnd = 8
            })
        }
        container.addView(stats)
        container.addView(dashboardLabel("Bookings", 19f, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = 24; bottomMargin = 10 })
        button("＋  New appointment") { bookingDialog() }
        button("▦  Appointment calendar") { showCalendar() }
        button("☰  All appointments") { showAppointments() }

        container.addView(dashboardLabel("Manage your business", 19f, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = 18; bottomMargin = 10 })
        button("Clients") { showClients() }
        button("Services & prices") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        button("Staff & working hours") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        button("Cloud account & backup") {
            startActivity(Intent(this, CloudActivity::class.java))
        }
        button("My booking link") {
            message("Online booking links are not yet connected in this Android build.")
        }
        button("Business settings") { showBusinessSettings() }
        container.addView(dashboardLabel("Boustio • Isolated preview • Phase 60.2", 12f),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = 16 })
    }

    private fun showCalendar() {
        activeTab = "Calendar"
        screen("Appointment calendar")

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

                message(
                    "Appointment cancelled"
                )
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

        if (
            services.isEmpty() ||
            staff.isEmpty()
        ) {
            AlertDialog.Builder(this)
                .setTitle("Setup required")
                .setMessage(
                    "Add at least one service and " +
                        "one staff member before " +
                        "creating smart bookings."
                )
                .setPositiveButton(
                    "OK",
                    null
                )
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
                android.R.layout
                    .simple_spinner_dropdown_item,
                serviceNames
            )

            val index = services.indexOfFirst {
                it.optString("id") ==
                    existing?.serviceId
            }

            if (index >= 0) {
                setSelection(index)
            } else if (existing != null) {
                val old = services.indexOfFirst {
                    it.optString("name") ==
                        existing.service
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
                android.R.layout
                    .simple_spinner_dropdown_item,
                staff.map {
                    "${it.optString("name")} · " +
                        it.optString("role")
                }
            )

            val index = staff.indexOfFirst {
                it.optString("id") ==
                    existing?.staffId
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

        var date =
            existing?.date ?: defaultDate

        var time =
            existing?.time ?: "09:00"

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

                    timeButton.text =
                        "Time: $time"
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
            .setPositiveButton(
                "Save",
                null
            )
            .setNegativeButton(
                "Cancel",
                null
            )
            .create()

        dialog.setOnShowListener {
            dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
            ).setOnClickListener {

                val name =
                    client.text.toString().trim()

                if (name.isBlank()) {
                    message(
                        "Enter a client name"
                    )
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

                if (
                    start + duration > 1440
                ) {
                    message(
                        "Appointment cannot finish " +
                            "after midnight"
                    )
                    return@setOnClickListener
                }

                val staffId =
                    member.optString("id")

                val conflict = bookings.any {
                    other ->

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

                val hours =
                    member.optString("hours")

                if (
                    !withinWorkingHours(
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

                val booking =
                    existing ?: Booking(
                        UUID.randomUUID()
                            .toString(),
                        "",
                        "",
                        "",
                        "",
                        ""
                    )

                booking.client = name

                booking.service =
                    service.optString("name")

                booking.serviceId =
                    service.optString("id")

                booking.staffId = staffId
                booking.duration = duration

                booking.price =
                    service.optString("price")

                booking.date = date
                booking.time = time

                booking.notes =
                    notes.text.toString().trim()

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

    // Supported working hours:
    // Mon-Fri 09:00-17:00
    // Mon,Wed,Fri 09:00-17:00
    // Mon 09:00-17:00
    // 09:00-17:00

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

        val match =
            pattern.matchEntire(
                hours.trim()
            ) ?: return false

        val from = runCatching {
            toMinutes(
                match.groupValues[2]
            )
        }.getOrNull() ?: return false

        val until = runCatching {
            toMinutes(
                match.groupValues[3]
            )
        }.getOrNull() ?: return false

        if (
            from !in 0..1439 ||
            until !in 1..1440 ||
            from >= until
        ) {
            return false
        }

        val days =
            match.groupValues[1].trim()

        if (days.isNotEmpty()) {
            val parsed = runCatching {
                SimpleDateFormat(
                    "yyyy-MM-dd",
                    Locale.UK
                ).apply {
                    isLenient = false
                }.parse(date)
            }.getOrNull() ?: return false

            val calendar =
                Calendar.getInstance().apply {
                    time = parsed
                }

            val current =
                (
                    calendar.get(
                        Calendar.DAY_OF_WEEK
                    ) + 5
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

            val allowed =
                mutableSetOf<Int>()

            for (
                part in days
                    .lowercase(Locale.UK)
                    .split(",")
            ) {
                val bounds =
                    part.trim().split("-")

                if (
                    bounds.size !in 1..2
                ) {
                    return false
                }

                val first = names.indexOf(
                    bounds[0]
                        .trim()
                        .take(3)
                )

                if (first < 0) {
                    return false
                }

                if (bounds.size == 1) {
                    allowed.add(first)
                } else {
                    val last =
                        names.indexOf(
                            bounds[1]
                                .trim()
                                .take(3)
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

        return start >= from &&
            end <= until
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
        activeTab = "Clients"
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
                    put(
                        "serviceId",
                        booking.serviceId
                    )
                    put(
                        "staffId",
                        booking.staffId
                    )
                    put(
                        "duration",
                        booking.duration
                    )
                    put(
                        "price",
                        booking.price
                    )
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

            for (
                i in 0 until array.length()
            ) {
                val item =
                    array.getJSONObject(i)

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
                        item.optInt(
                            "duration",
                            0
                        ),
                        item.optString("price")
                    )
                )
            }
        } catch (_: Exception) {
            message(
                "Could not load saved bookings"
            )
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

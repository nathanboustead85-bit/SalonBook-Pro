package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
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
        var notes: String
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        loadBookings()
        showDashboard()
    }

    private fun today(): String {
        return SimpleDateFormat(
            "yyyy-MM-dd", Locale.UK
        ).format(System.currentTimeMillis())
    }

    private fun screen(title: String) {
        val scroll = ScrollView(this)
        scroll.setBackgroundColor(background)

        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 45, 32, 40)
        }

        scroll.addView(container)
        setContentView(scroll)

        val heading = TextView(this).apply {
            text = title
            textSize = 27f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(purple)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
        }

        container.addView(heading)
    }

    private fun text(
        value: String,
        size: Float = 16f
    ) {
        container.addView(TextView(this).apply {
            this.text = value
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
                android.content.res.ColorStateList.valueOf(
                    purple
                )
            setOnClickListener { action() }
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

        text("Your Beauty Business. Simplified.", 17f)

        val todayCount = bookings.count {
            it.date == today()
        }

        val upcomingCount = bookings.count {
            it.date >= today()
        }

        text("Today's appointments: $todayCount", 20f)
        text("Upcoming appointments: $upcomingCount", 20f)
        text("Total saved bookings: ${bookings.size}", 18f)

        button("View Appointment Calendar") {
            showCalendar()
        }

        button("Create New Booking") {
            bookingDialog()
        }

        button("All Appointments") {
            showAppointments(false)
        }

        button("Clients") {
            showClients()
        }

        // MILESTONE 3: SERVICES & PRICES
        button("Services & Prices") {
            startActivity(
                Intent(
                    this,
                    ManagementActivity::class.java
                ).putExtra("staff", false)
            )
        }

        // MILESTONE 3: STAFF MANAGEMENT
        button("Staff Management") {
            startActivity(
                Intent(
                    this,
                    ManagementActivity::class.java
                ).putExtra("staff", true)
            )
        }

        button("My Booking Link") {
            message("Online booking links require the backend")
        }

        button("Business Settings") {
            message("Business settings are coming next")
        }

        text("SalonBook Pro | Milestone 3", 12f)
    }

    private fun showCalendar() {
        screen("Appointment Calendar")

        text("Selected date: $selectedDate", 19f)

        button("Choose Date") {
            pickDate(selectedDate) {
                selectedDate = it
                showCalendar()
            }
        }

        button("Add Booking for This Date") {
            bookingDialog(defaultDate = selectedDate)
        }

        val daily = bookings
            .filter { it.date == selectedDate }
            .sortedBy { it.time }

        text("${daily.size} appointments", 18f)

        if (daily.isEmpty()) {
            text("No appointments for this date.")
        }

        daily.forEach { booking ->
            bookingCard(booking)
        }

        button("Back to Dashboard") {
            showDashboard()
        }
    }

    private fun showAppointments(
        upcomingOnly: Boolean
    ) {
        screen("All Appointments")

        val list = bookings
            .filter { !upcomingOnly || it.date >= today() }
            .sortedWith(
                compareBy<Booking> { it.date }
                    .thenBy { it.time }
            )

        if (list.isEmpty()) {
            text("No appointments saved yet.")
        }

        list.forEach {
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

        val details = TextView(this).apply {
            text = "${booking.time}  •  ${booking.client}\n" +
                "${booking.service}\n${booking.date}" +
                if (booking.notes.isBlank()) ""
                else "\nNotes: ${booking.notes}"

            textSize = 16f
            setTextColor(dark)
            setPadding(0, 0, 0, 12)
        }

        card.addView(details)

        val edit = Button(this).apply {
            text = "Edit / Cancel"
            isAllCaps = false
            setOnClickListener {
                bookingOptions(booking)
            }
        }

        card.addView(edit)

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
                arrayOf("Edit Booking", "Cancel Booking")
            ) { _, which ->
                when (which) {
                    0 -> bookingDialog(booking)
                    1 -> confirmCancel(booking)
                }
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun confirmCancel(booking: Booking) {
        AlertDialog.Builder(this)
            .setTitle("Cancel appointment?")
            .setMessage(
                "Remove ${booking.client}'s appointment " +
                "on ${booking.date} at ${booking.time}?"
            )
            .setPositiveButton("Cancel Appointment") { _, _ ->
                bookings.removeAll { it.id == booking.id }
                saveBookings()
                showDashboard()
                message("Appointment cancelled")
            }
            .setNegativeButton("Keep Booking", null)
            .show()
    }

    private fun bookingDialog(
        existing: Booking? = null,
        defaultDate: String = selectedDate
    ) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 15, 32, 0)
        }

        fun field(
            hint: String,
            value: String = ""
        ): EditText {
            val input = EditText(this).apply {
                this.hint = hint
                setSingleLine(true)
                setText(value)
            }
            layout.addView(input)
            return input
        }

        val client = field(
            "Client name",
            existing?.client ?: ""
        )

        val service = field(
            "Service (e.g. Haircut)",
            existing?.service ?: ""
        )

        val notes = field(
            "Notes (optional)",
            existing?.notes ?: ""
        )

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

        layout.addView(dateButton)

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

        layout.addView(timeButton)

        val dialog = AlertDialog.Builder(this)
            .setTitle(
                if (existing == null) "New Booking"
                else "Edit Booking"
            )
            .setView(layout)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
            ).setOnClickListener {

                val name = client.text.toString().trim()
                val treatment = service.text.toString().trim()

                if (name.isBlank() || treatment.isBlank()) {
                    message("Enter a client name and service")
                    return@setOnClickListener
                }

                if (existing == null) {
                    bookings.add(
                        Booking(
                            UUID.randomUUID().toString(),
                            name,
                            treatment,
                            date,
                            time,
                            notes.text.toString().trim()
                        )
                    )
                } else {
                    existing.client = name
                    existing.service = treatment
                    existing.date = date
                    existing.time = time
                    existing.notes =
                        notes.text.toString().trim()
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

        val clients = bookings
            .map { it.client }
            .distinct()
            .sorted()

        text("${clients.size} clients", 18f)

        if (clients.isEmpty()) {
            text("Clients appear here after bookings are added.")
        }

        clients.forEach { name ->
            val count = bookings.count {
                it.client == name
            }
            text("$name — $count booking(s)")
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
                }
            )
        }

        prefs.edit()
            .putString("bookings", array.toString())
            .apply()
    }

    private fun loadBookings() {
        bookings.clear()

        val saved = prefs.getString("bookings", "[]") ?: "[]"

        try {
            val array = JSONArray(saved)

            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)

                bookings.add(
                    Booking(
                        item.optString("id"),
                        item.optString("client"),
                        item.optString("service"),
                        item.optString("date"),
                        item.optString("time"),
                        item.optString("notes")
                    )
                )
            }
        } catch (e: Exception) {
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

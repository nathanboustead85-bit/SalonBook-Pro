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
import android.os.Build
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.WindowManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.Source
import com.google.firebase.firestore.ListenerRegistration
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID

class MainActivity : Activity() {
    // Phase 12.1 premium Boustio design tokens. Retain legacy field names for compatibility.
    private val orange = Color.rgb(17, 107, 104) // signature teal
    private val dark = Color.rgb(23, 51, 50) // deep forest
    private val background = Color.rgb(247, 248, 246) // soft ivory
    private val muted = Color.rgb(101, 113, 111)
    private val paleOrange = Color.rgb(231, 243, 239)
    private val lightBorder = Color.rgb(223, 230, 225)
    private val premiumGold = Color.rgb(217, 173, 116)
    private val prefs by lazy { getSharedPreferences("salonbook_data", MODE_PRIVATE) }
    private val bookings = mutableListOf<Booking>()
    private var selectedDate = today()
    private lateinit var container: LinearLayout
    private lateinit var navigationBar: LinearLayout
    private var currentScreen = "dashboard"
    private var cloudCalendarListener: ListenerRegistration? = null
    private var debugCalendarSource: DevelopmentCalendarSource? = null

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
                "client_profile" -> showClients()
                "settings" -> showSettings()
                "availability" -> showAvailabilityTester()
                else -> showDashboard()
            }
        }
    }

    private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.UK)
        .format(System.currentTimeMillis())
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun rounded(colour: Int, radius: Int = 20) = GradientDrawable().apply {
        setColor(colour)
        cornerRadius = dp(radius).toFloat()
    }
    private fun label(value: String, size: Float = 16f, colour: Int = dark, bold: Boolean = false) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(colour)
            if (bold) typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            includeFontPadding = true
        }
    private fun styleButton(button: Button, filled: Boolean = true) {
        button.isAllCaps = false
        button.textSize = 15f
        button.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        button.minHeight = dp(48)
        button.setTextColor(if (filled) Color.WHITE else orange)
        button.backgroundTintList = ColorStateList.valueOf(if (filled) orange else paleOrange)
    }
    private fun readRecords(key: String): List<JSONObject> = try {
        val array = JSONArray(prefs.getString(key, "[]") ?: "[]")
        (0 until array.length()).map { array.getJSONObject(it) }
    } catch (_: Exception) { emptyList() }

    private fun screen(title: String, subtitle: String = "", mode: String = "other") {
        if (mode != "calendar") debugCalendarSource?.stop()
        currentScreen = mode
        // Ensure Android lays out our content below the system status bar.
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = background
        window.navigationBarColor = background
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(this@MainActivity.background)
        }
        val scroll = ScrollView(this).apply {
            setBackgroundColor(this@MainActivity.background)
            isFillViewport = true
            clipToPadding = false
        }
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(28))
        }
        scroll.addView(container)
        root.addView(scroll, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        navigationBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
            setBackgroundColor(Color.WHITE)
            elevation = dp(8).toFloat()
        }
        root.addView(navigationBar, LinearLayout.LayoutParams(-1, dp(74)))
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        }
        setContentView(root)
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener { _, insets ->
                val topInset = insets.getInsets(android.view.WindowInsets.Type.statusBars()).top
                val bottomInset = insets.getInsets(android.view.WindowInsets.Type.navigationBars()).bottom
                root.setPadding(0, topInset, 0, bottomInset)
                insets
            }
        }
        updateNavigation(mode)
        container.addView(ImageView(this).apply {
            setImageResource(R.drawable.boustio_logo)
            scaleType = ImageView.ScaleType.FIT_START
            adjustViewBounds = true
            contentDescription = "Boustio"
        }, LinearLayout.LayoutParams(dp(166), dp(54)))
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

    private class NavIcon(context: android.content.Context, private val kind: String,
                          private val tint: Int) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = tint; style = Paint.Style.STROKE; strokeWidth = 2f
            strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
        }
        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val size = minOf(width, height).toFloat()
            canvas.save()
            canvas.translate((width - size) / 2f, (height - size) / 2f)
            canvas.scale(size / 24f, size / 24f)
            when (kind) {
                "dashboard" -> {
                    val path = Path().apply {
                        moveTo(3f, 11f); lineTo(12f, 3f); lineTo(21f, 11f)
                        moveTo(5f, 10f); lineTo(5f, 21f); lineTo(19f, 21f); lineTo(19f, 10f)
                    }
                    canvas.drawPath(path, paint)
                    canvas.drawRect(10f, 14f, 14f, 21f, paint)
                }
                "calendar" -> {
                    canvas.drawRoundRect(3f, 5f, 21f, 21f, 2f, 2f, paint)
                    canvas.drawLine(3f, 10f, 21f, 10f, paint)
                    canvas.drawLine(8f, 3f, 8f, 7f, paint)
                    canvas.drawLine(16f, 3f, 16f, 7f, paint)
                    for (x in listOf(8f, 12f, 16f)) for (y in listOf(14f, 18f))
                        canvas.drawCircle(x, y, 0.7f, paint)
                }
                "clients" -> {
                    canvas.drawCircle(12f, 8f, 3f, paint)
                    canvas.drawArc(5f, 13f, 19f, 22f, 180f, 180f, false, paint)
                    canvas.drawArc(1f, 7f, 7f, 15f, 200f, 135f, false, paint)
                    canvas.drawArc(17f, 7f, 23f, 15f, 205f, 135f, false, paint)
                }
                "settings" -> {
                    canvas.drawCircle(12f, 12f, 3f, paint)
                    canvas.drawCircle(12f, 12f, 8f, paint)
                    for (i in 0 until 8) {
                        val a = i * Math.PI / 4
                        canvas.drawLine(12f + 8f * kotlin.math.cos(a).toFloat(),
                            12f + 8f * kotlin.math.sin(a).toFloat(),
                            12f + 10f * kotlin.math.cos(a).toFloat(),
                            12f + 10f * kotlin.math.sin(a).toFloat(), paint)
                    }
                }
            }
            canvas.restore()
        }
    }

    private fun updateNavigation(mode: String) {
        if (!::navigationBar.isInitialized) return
        navigationBar.removeAllViews()
        val active = when (mode) {
            "calendar", "appointments" -> "calendar"
            "clients", "client_profile" -> "clients"
            "settings" -> "settings"
            else -> "dashboard"
        }
        val destinations = listOf("Home" to "dashboard", "Calendar" to "calendar",
            "Clients" to "clients", "Settings" to "settings")
        destinations.forEach { (title, destination) ->
            val selected = destination == active
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(dp(2), dp(5), dp(2), dp(5))
                background = rounded(if (selected) paleOrange else Color.WHITE, 12)
                isClickable = true
                isFocusable = true
                contentDescription = title
                setOnClickListener {
                    when (destination) {
                        "dashboard" -> showDashboard()
                        "calendar" -> showCalendar()
                        "clients" -> showClients()
                        "settings" -> showSettings()
                    }
                }
            }
            item.addView(NavIcon(this, destination, if (selected) orange else muted),
                LinearLayout.LayoutParams(dp(24), dp(24)))
            item.addView(label(title, 11f, if (selected) orange else muted, selected).apply {
                gravity = Gravity.CENTER
            }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(3) })
            navigationBar.addView(item, LinearLayout.LayoutParams(0, -1, 1f).apply {
                marginStart = dp(2); marginEnd = dp(2)
            })
        }
    }

    private fun showSettings() {
        screen("Business settings", "Make Boustio work beautifully for your business.", "settings")
        val settingsIntro = panel()
        settingsIntro.addView(label("YOUR BUSINESS • BOUSTIO", 12f, orange, true))
        settingsIntro.addView(label("Everything in its place", 21f, dark, true))
        settingsIntro.addView(label("Manage your services, team, booking link and account from one place.", 13f, muted))
        addPanel(settingsIntro)
        section("Business management")
        actionCard("Services & Prices", "Manage your service catalogue", "£") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        actionCard("Staff & Working Hours", "Manage your team and availability", "♧") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        actionCard("My Boustio Booking Link", "Manage your public booking profile", "↗") {
            startActivity(Intent(this, BusinessProfileActivity::class.java))
        }
        actionCard("Customer Messages", "Private chat inbox (preview)", "✉") {
            startActivity(Intent(this, ChatInboxActivity::class.java))
        }
        section("Account and tools")
        actionCard("Cloud Account & Backup", "Cloud account, backup and restore", "☁") {
            startActivity(Intent(this, CloudActivity::class.java))
        }
        actionCard("Test Appointment Availability", "Check booking slots", "✓") {
            showAvailabilityTester()
        }
        section("Appointments")
        actionCard("All Appointments", "Browse and manage every booking", "◷") {
            showAppointments()
        }
        button("Back to Dashboard") { showDashboard() }
        container.addView(label("BOUSTIO  •  A BOOKING PLATFORM WITH A DIFFERENCE", 12f, muted))
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
                topMargin = dp(16)
                bottomMargin = dp(10)
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

    private fun actionCard(
        heading: String,
        description: String,
        symbol: String,
        action: () -> Unit
    ) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(16))
            background = rounded(Color.WHITE, 18)
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            setOnClickListener { action() }
        }
        val symbolBox = TextView(this).apply {
            text = symbol
            textSize = 22f
            gravity = Gravity.CENTER
            setTextColor(orange)
            background = rounded(paleOrange, 14)
        }
        row.addView(symbolBox, LinearLayout.LayoutParams(dp(52), dp(52)))
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), 0, dp(4), 0)
        }
        content.addView(label(heading, 16f, dark, true))
        content.addView(label(description, 12f, muted), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(4)
        })
        row.addView(content, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(label("›", 26f, orange, true))
        addPanel(row)
    }

    private fun showDashboard() {
        screen("Good to see you", "Your business, beautifully organised.", "dashboard")

        val todayCount = bookings.count { it.date == today() }
        val currentClock = SimpleDateFormat("HH:mm", Locale.UK).format(Date())
        val upcomingBookings = bookings.filter { it.date > today() ||
            (it.date == today() && it.time >= currentClock) }
        val upcoming = upcomingBookings.size
        val summary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(22), dp(22), dp(22))
            background = rounded(orange, 24)
        }
        summary.addView(label("YOUR DAY  •  BOUSTIO", 12f, Color.WHITE, true))
        summary.addView(label("$todayCount appointment${if (todayCount == 1) "" else "s"}",
            30f, Color.WHITE, true), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(10)
        })
        summary.addView(label(displayDate(today()), 14f, Color.WHITE),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
        container.addView(summary, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8)
            bottomMargin = dp(16)
        })

        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        fun stat(title: String, value: String): LinearLayout {
            return LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(16), dp(12), dp(16))
                background = rounded(Color.WHITE, 18)
                elevation = dp(2).toFloat()
                addView(label(value, 27f, dark, true))
                addView(label(title, 12f, muted), LinearLayout.LayoutParams(-1, -2).apply {
                    topMargin = dp(5)
                })
            }
        }
        stats.addView(stat("Upcoming", upcoming.toString()),
            LinearLayout.LayoutParams(0, -2, 1f).apply { marginEnd = dp(6) })
        stats.addView(stat("Total bookings", bookings.size.toString()),
            LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = dp(6) })
        container.addView(stats)

        // Phase 12.2: next appointments are read from existing local bookings only.
        // This is a presentation-only preview; no booking or cloud data is modified.
        section("Coming up")
        val nextBookings = upcomingBookings
            .sortedWith(compareBy<Booking> { it.date }.thenBy { it.time })
            .take(3)
        if (nextBookings.isEmpty()) {
            val emptyUpcoming = panel()
            emptyUpcoming.addView(label("Your schedule is clear", 18f, dark, true))
            emptyUpcoming.addView(label("New appointments will appear here as they're booked.", 13f, muted))
            addPanel(emptyUpcoming)
        } else {
            nextBookings.forEach { appointment ->
                val upcomingCard = panel()
                val appointmentRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                }
                val timeColumn = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(0, 0, dp(16), 0)
                }
                timeColumn.addView(label(appointment.time, 18f, orange, true))
                timeColumn.addView(label(dayPart(appointment.date, "EEE d MMM"), 12f, muted))
                appointmentRow.addView(timeColumn, LinearLayout.LayoutParams(dp(106), -2))
                val details = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                details.addView(label(appointment.client, 16f, dark, true))
                details.addView(label(appointment.service, 13f, muted))
                appointmentRow.addView(details, LinearLayout.LayoutParams(0, -2, 1f))
                upcomingCard.addView(appointmentRow)
                addPanel(upcomingCard)
            }
            button("View full calendar") { selectedDate = today(); showCalendar() }
        }

        section("Quick actions")
        button("+ New Appointment") { bookingDialog(defaultDate = today()) }
        actionCard("Appointment Calendar", "View your daily schedule", "▦") { showCalendar() }
        actionCard("All Appointments", "Browse and manage bookings", "◷") { showAppointments() }

        section("Manage your business")
        actionCard("Clients", "Your client directory", "♙") { showClients() }
        actionCard("Services & Prices", "Treatments, prices and durations", "£") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        actionCard("Staff & Working Hours", "Team schedules and availability", "♧") {
            startActivity(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        actionCard("My Boustio Booking Link", "Your public booking profile", "↗") {
            startActivity(Intent(this, BusinessProfileActivity::class.java))
        }

        actionCard("Customer Messages", "Private chat inbox (preview)", "✉") {
            startActivity(Intent(this, ChatInboxActivity::class.java))
        }

        section("Account & tools")
        actionCard("Cloud Account & Backup", "Account, backup and restore", "☁") {
            startActivity(Intent(this, CloudActivity::class.java))
        }
        actionCard("Test Appointment Availability", "Check available booking slots", "✓") {
            showAvailabilityTester()
        }
        container.addView(label("BOUSTIO  •  PREMIUM BUSINESS EXPERIENCE", 12f, muted),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
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


    override fun onDestroy() {
        debugCalendarSource?.stop()
        cloudCalendarListener?.remove()
        super.onDestroy()
    }

    private fun showSharedCloudAppointments(date: String, overviewWebsiteStatus: TextView? = null) {
        cloudCalendarListener?.remove()
        cloudCalendarListener = null
        section("Website/shared appointments · separate cloud feed")
        val target = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        container.addView(target)
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null || !user.isEmailVerified) {
            overviewWebsiteStatus?.text = "Website bookings: sign-in required · not included in phone count"
            target.addView(label("Verified sign-in required for cloud calendar.", 13f, muted))
            return
        }
        target.addView(label("Checking website/shared appointment feed…", 13f, muted))
        cloudCalendarListener = FirebaseFirestore.getInstance()
            .collection("businesses").document(user.uid)
            .collection("appointments").whereEqualTo("date", date)
            .addSnapshotListener { snapshot, error ->
                if (currentScreen != "calendar" || selectedDate != date || isFinishing || isDestroyed ||
                    FirebaseAuth.getInstance().currentUser?.uid != user.uid) {
                    return@addSnapshotListener
                }
                target.removeAllViews()
                if (error != null || snapshot == null) {
                    overviewWebsiteStatus?.text = "Website bookings: unavailable · phone count unchanged"
                    target.addView(label("Website/shared feed unavailable. Your phone appointments and their cloud backup are separate and unchanged.", 13f, muted))
                    return@addSnapshotListener
                }
                val items = snapshot.documents.mapNotNull { doc ->
                    val status = doc.getString("status")
                    if (status == "cancelled" || status == "canceled") return@mapNotNull null
                    val start = doc.getString("startTime") ?: return@mapNotNull null
                    Triple(start, doc.getString("customerName") ?: "Customer",
                        (doc.getString("serviceName") ?: "Service") + " · " +
                        (doc.getString("staffName") ?: "Staff"))
                }.sortedBy { it.first }
                // Phase 11.66: cached Firestore results are not confirmed server data.
                // Keep the website feed read-only and clearly distinguish offline/stale data.
                val websiteSource = if (snapshot.metadata.isFromCache) {
                    "cached/offline · may be outdated"
                } else {
                    "server-confirmed"
                }
                overviewWebsiteStatus?.text = "${items.size} website/shared appointment(s) · ${websiteSource} · separate read-only feed; not added to phone count"
                target.addView(label(
                    "Website feed: ${websiteSource}. Phone appointments remain separate and unchanged.",
                    13f, if (snapshot.metadata.isFromCache) orange else muted))
                if (items.isEmpty()) {
                    target.addView(label("No website/shared appointments on this date. This is a separate feed from your phone bookings; it does not mean your phone appointments are missing.", 13f, muted))
                }
                // Phase 11.63: compare visible start times only. This is a warning,
                // not a definitive overlap check (durations and staff may differ).
                // Never merge website documents into the legacy phone snapshot.
                val localAtDisplay = bookings.filter { it.date == date }
                val localStarts = localAtDisplay.map { it.time }.toSet()
                val websiteStarts = items.groupingBy { it.first }.eachCount()
                val possibleCollisions = items.count { (start, _, _) ->
                    start in localStarts || (websiteStarts[start] ?: 0) > 1
                }
                if (items.isNotEmpty()) {
                    target.addView(label(
                        "${items.size} website/shared appointment(s) shown separately. " +
                            "${possibleCollisions} possible same-start-time collision(s). " +
                            "These are warnings only; staff and duration must be reviewed manually. " +
                            "No website bookings have been imported.",
                        13f, muted))
                }
                items.forEach { (start, client, details) ->
                    val item = panel()
                    item.addView(label("$start  $client", 16f, dark, true))
                    item.addView(label(details, 13f, muted))
                    if (start in localStarts || (websiteStarts[start] ?: 0) > 1) {
                        item.addView(label(
                            "POSSIBLE TIME COLLISION · review staff and duration manually",
                            12f, orange))
                    }
                    item.addView(label("Website/shared feed · read only · not imported", 12f, orange))
                    target.addView(item)
                }
            }
    }

    // Phase 11.32: server-confirmed, read-only comparison. Never auto-overwrite
    // local appointments from a different device or a stale cloud snapshot.
    private fun showLegacyMultiDeviceReadiness(date: String) {
        section("Multi-device readiness · read only")
        val status = label("Checking server-confirmed booking data…", 13f, muted)
        container.addView(status)
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            status.text = "Sign in with a verified account to compare devices."
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { document ->
                if (currentScreen != "calendar" || selectedDate != date ||
                    isFinishing || isDestroyed || FirebaseAuth.getInstance().currentUser?.uid != owner.uid) {
                    return@addOnSuccessListener
                }
                if (!document.exists()) {
                    status.text = "No server booking snapshot. Automatic device merge is disabled."
                    return@addOnSuccessListener
                }
                try {
                    if (document.getLong("schemaVersion") != 1L) {
                        status.text = "Unsupported cloud booking schema. No changes made."
                        return@addOnSuccessListener
                    }
                    val remote = JSONArray(document.getString("json") ?: throw IllegalStateException("Missing booking data"))
                    val cloudIds = mutableSetOf<String>()
                    var cloudCount = 0
                    for (i in 0 until remote.length()) {
                        val entry = remote.getJSONObject(i)
                        if (entry.optString("date") == date) {
                            cloudCount++
                            cloudIds.add(entry.optString("id"))
                        }
                    }
                    val local = bookings.filter { it.date == date }
                    val localIds = local.map { it.id }.toSet()
                    status.text = if (cloudIds == localIds && cloudCount == local.size) {
                        "Server and phone agree on ${local.size} appointment(s) for this date. Read-only check."
                    } else {
                        "Device difference: phone ${local.size}, server $cloudCount appointment(s). " +
                            "Do not overwrite either copy. Review both before synchronising."
                    }
                } catch (_: Exception) {
                    status.text = "Cloud booking data could not be compared safely. No changes made."
                }
            }
            .addOnFailureListener {
                if (currentScreen == "calendar" && selectedDate == date && !isFinishing && !isDestroyed) {
                    status.text = "Server comparison unavailable. Local appointments unchanged."
                }
            }
    }

    // Phase 11.35: display server-only bookings without importing or
    // overwriting the phone. A safe preview is required before any merge UI.
    private fun showCloudBookingDifferences(date: String) {
        section("Cloud booking differences · read only")
        val status = label("Checking cloud bookings from other devices…", 13f, muted)
        container.addView(status)
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            status.text = "Sign in with a verified account to review cloud bookings."
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { document ->
                if (currentScreen != "calendar" || selectedDate != date ||
                    isFinishing || isDestroyed ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid) {
                    return@addOnSuccessListener
                }
                try {
                    if (!document.exists()) {
                        status.text = "No cloud snapshot available. Phone appointments unchanged."
                        return@addOnSuccessListener
                    }
                    check(document.getLong("schemaVersion") == 1L) {
                        "Unsupported cloud booking schema"
                    }
                    val remote = JSONArray(document.getString("json")
                        ?: throw IllegalStateException("Missing cloud booking data"))
                    val localById = bookings.associateBy { it.id }
                    val seen = mutableSetOf<String>()
                    val differences = mutableListOf<String>()
                    for (i in 0 until remote.length()) {
                        val entry = remote.getJSONObject(i)
                        val id = entry.optString("id")
                        check(id.isNotBlank() && seen.add(id)) {
                            "Invalid or duplicate cloud booking ID"
                        }
                        if (entry.optString("date") != date) continue
                        val local = localById[id]
                        if (local == null) {
                            differences.add("Cloud only: ${entry.optString("time")} · " +
                                entry.optString("client", "Client") + " · " +
                                entry.optString("service", "Service"))
                        } else if (local.date != entry.optString("date") ||
                            local.time != entry.optString("time") ||
                            local.client != entry.optString("client") ||
                            local.service != entry.optString("service") ||
                            local.staffId != entry.optString("staffId") ||
                            local.duration != entry.optInt("duration") ||
                            local.notes != entry.optString("notes")) {
                            differences.add("Changed on cloud: ${entry.optString("time")} · " +
                                entry.optString("client", "Client"))
                        }
                    }
                    val remoteIds = seen
                    bookings.filter { it.date == date && it.id !in remoteIds }.forEach {
                        differences.add("Phone only: ${it.time} · ${it.client}")
                    }
                    status.text = if (differences.isEmpty()) {
                        "No cloud-only or changed bookings found for this date. " +
                            "Read-only review; no data transferred."
                    } else {
                        differences.joinToString("\n") +
                            "\nNo bookings were imported or overwritten."
                    }
                } catch (_: Exception) {
                    status.text = "Cloud differences could not be checked safely. No changes made."
                }
            }
            .addOnFailureListener {
                if (currentScreen == "calendar" && selectedDate == date &&
                    !isFinishing && !isDestroyed) {
                    status.text = "Server unavailable. Phone bookings remain unchanged."
                }
            }
    }

    // Phase 11.36: explicit, additive import of cloud-only appointments.
    // Never replace existing IDs, delete phone bookings, or upload on import.
    private fun previewCloudOnlyImport(date: String) {
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            message("Sign in with a verified account first")
            return
        }
        val originalIds = bookings.map { it.id }.toSet()
        if (originalIds.size != bookings.size || originalIds.any { it.isBlank() }) {
            message("Local appointment IDs need review before cloud recovery")
            return
        }
        val originalJson = prefs.getString("bookings", "[]") ?: "[]"
        val reference = FirebaseFirestore.getInstance().collection("users")
            .document(owner.uid).collection("liveData").document("bookings")
        reference.get(Source.SERVER).addOnSuccessListener { snapshot ->
            if (currentScreen != "calendar" || selectedDate != date ||
                isFinishing || isDestroyed ||
                FirebaseAuth.getInstance().currentUser?.uid != owner.uid) return@addOnSuccessListener
            try {
                check(snapshot.exists() && snapshot.getLong("schemaVersion") == 1L) {
                    "Cloud booking snapshot unavailable"
                }
                val snapshotJson = snapshot.getString("json")
                    ?: error("Missing cloud bookings")
                val remote = JSONArray(snapshotJson)
                val seen = mutableSetOf<String>()
                val candidates = mutableListOf<Booking>()
                for (i in 0 until remote.length()) {
                    val entry = remote.getJSONObject(i)
                    val id = entry.optString("id")
                    check(id.isNotBlank() && seen.add(id)) {
                        "Invalid or duplicate cloud booking ID"
                    }
                    if (entry.optString("date") != date || id in originalIds) continue
                    val candidate = Booking(
                        id, entry.optString("client"), entry.optString("service"),
                        entry.optString("date"), entry.optString("time"),
                        entry.optString("notes"), entry.optString("serviceId"),
                        entry.optString("staffId"), entry.optInt("duration"),
                        entry.optString("price")
                    )
                    check(candidate.time.matches(Regex("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) &&
                        toMinutes(candidate.time) + candidate.duration <= 24 * 60 &&
                        candidate.duration > 0 && candidate.staffId.isNotBlank() &&
                        candidate.client.isNotBlank()) {
                        "Incomplete cloud appointment; import blocked"
                    }
                    check(candidates.none { earlier ->
                        earlier.staffId == candidate.staffId &&
                            toMinutes(earlier.time) < toMinutes(candidate.time) + candidate.duration &&
                            toMinutes(candidate.time) < toMinutes(earlier.time) + earlier.duration
                    }) { "Cloud appointments overlap; import blocked" }
                    candidates.add(candidate)
                }
                if (candidates.isEmpty()) {
                    message("No cloud-only appointments to import on this date")
                    return@addOnSuccessListener
                }
                AlertDialog.Builder(this)
                    .setTitle("Import ${candidates.size} cloud appointment(s)?")
                    .setMessage("Add cloud-only appointments for ${displayDate(date)} to this phone? " +
                        "Existing appointments will not be replaced. " +
                        "The server will be checked again before importing.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Check and import") { _, _ ->
                        reference.get(Source.SERVER).addOnSuccessListener { fresh ->
                            try {
                                check(FirebaseAuth.getInstance().currentUser?.uid == owner.uid &&
                                    currentScreen == "calendar" && selectedDate == date) {
                                    "Account or screen changed"
                                }
                                check(fresh.exists() && fresh.getLong("schemaVersion") == 1L &&
                                    fresh.getString("json") == snapshotJson) {
                                    "Cloud bookings changed. Review again before importing."
                                }
                                check(prefs.getString("bookings", "[]") == originalJson &&
                                    bookings.map { it.id }.toSet() == originalIds) {
                                    "Phone bookings changed. Review again before importing."
                                }
                                check(originalIds.size == bookings.size) {
                                    "Duplicate local appointment IDs. Import blocked."
                                }
                                val combined = bookings.toMutableList()
                                for (candidate in candidates) {
                                    check(combined.none { existing ->
                                        existing.id == candidate.id ||
                                        (existing.date == candidate.date &&
                                            existing.staffId == candidate.staffId &&
                                            toMinutes(existing.time) < toMinutes(candidate.time) + candidate.duration &&
                                            toMinutes(candidate.time) < toMinutes(existing.time) + existing.duration)
                                    }) { "Appointment overlap or duplicate. Import blocked." }
                                    combined.add(candidate)
                                }
                                val array = JSONArray()
                                combined.forEach { booking ->
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
                                check(prefs.edit().putString("bookings", array.toString()).commit()) {
                                    "Could not save imported bookings"
                                }
                                loadBookings()
                                showCalendar()
                                message("Cloud-only appointments imported to this phone")
                            } catch (error: Exception) {
                                message(error.localizedMessage ?: "Import blocked safely")
                            }
                        }.addOnFailureListener {
                            message("Cloud unavailable. Import cancelled.")
                        }
                    }.show()
            } catch (error: Exception) {
                message(error.localizedMessage ?: "Cloud import preview unavailable")
            }
        }.addOnFailureListener { message("Cloud unavailable. Import cancelled.") }
    }

    // Phase 11.41: local, debug-only recovery rehearsal. Never touches Firestore,
    // SharedPreferences, or the real bookings list. All sample data is in memory.
    private fun showIsolatedRecoveryRehearsal(date: String) {
        if (!BuildConfig.DEBUG) return
        val sampleExisting = Booking("demo-local", "Demo existing client", "Demo haircut",
            date, "09:00", "", "demo-service", "demo-staff", 30, "20")
        val sampleRemote = Booking("demo-cloud", "Demo cloud client", "Demo haircut",
            date, "10:00", "", "demo-service", "demo-staff", 30, "20")
        val samplePhone = listOf(sampleExisting)
        val sampleCloud = listOf(sampleExisting, sampleRemote)
        val pending = sampleCloud.filter { cloud -> samplePhone.none { it.id == cloud.id } }
        AlertDialog.Builder(this)
            .setTitle("Isolated recovery rehearsal · demo only")
            .setMessage("Simulated phone: ${samplePhone.size} appointment. " +
                "Simulated cloud: ${sampleCloud.size} appointments. " +
                "Cloud-only: ${pending.size} at ${sampleRemote.time}. " +
                "No real appointments or Firebase data will change.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Rehearse import") { _, _ ->
                val combined = samplePhone.toMutableList()
                val safe = pending.all { candidate ->
                    combined.none { existing ->
                        existing.id == candidate.id ||
                            (existing.date == candidate.date &&
                                existing.staffId == candidate.staffId &&
                                toMinutes(existing.time) < toMinutes(candidate.time) + candidate.duration &&
                                toMinutes(candidate.time) < toMinutes(existing.time) + existing.duration)
                    }.also { accepted -> if (accepted) combined.add(candidate) }
                }
                AlertDialog.Builder(this)
                    .setTitle(if (safe) "Demo recovery passed" else "Demo recovery blocked")
                    .setMessage(if (safe) "Demo phone now has ${combined.size} simulated appointments. " +
                        "Your real calendar and cloud data were not modified." else
                        "Simulated booking conflict detected. Real data unchanged.")
                    .setPositiveButton("Close", null)
                    .show()
            }.show()
    }

    // Phase 11.44: deterministic, in-memory offline/reconnect demonstration.
    // No actual network changes, Firestore writes or local booking persistence.
    private fun showOfflineReconnectRehearsal(date: String) {
        if (!BuildConfig.DEBUG) return
        val baseline = Booking("demo-base", "Demo original", "Cut", date,
            "09:00", "", "demo-service", "demo-staff", 30, "20")
        val offlineEdit = Booking("demo-offline", "Demo offline booking", "Cut", date,
            "11:00", "", "demo-service", "demo-staff", 30, "20")
        val otherDevice = Booking("demo-other", "Demo second device", "Cut", date,
            "10:00", "", "demo-service", "demo-staff", 30, "20")
        val originalServer = listOf(baseline)
        val offlinePhone = listOf(baseline, offlineEdit)
        val changedServer = listOf(baseline, otherDevice)
        AlertDialog.Builder(this)
            .setTitle("Offline reconnect rehearsal · demo only")
            .setMessage("Simulated phone goes offline and saves an 11:00 booking. " +
                "A second simulated device adds a 10:00 cloud booking. " +
                "On reconnect, the old phone snapshot must not overwrite the cloud. " +
                "No real appointments, internet settings or Firebase data will change.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Rehearse reconnect") { _, _ ->
                val cloudChanged = changedServer != originalServer
                val cloudOnlyIds = changedServer.map { it.id }.toSet() -
                    offlinePhone.map { it.id }.toSet()
                val blocked = cloudChanged && cloudOnlyIds.isNotEmpty()
                AlertDialog.Builder(this)
                    .setTitle(if (blocked) "Demo conflict safely blocked" else
                        "Demo conflict protection failed")
                    .setMessage(if (blocked) {
                        "Stale upload rejected. Simulated phone keeps ${offlinePhone.size} " +
                            "appointments; simulated cloud keeps ${changedServer.size}. " +
                            "The cloud-only booking was preserved. " +
                            "Review required before any real sync. " +
                            "Your real appointments and Firebase data were not modified."
                    } else {
                        "Expected conflict was not detected. Real data unchanged."
                    })
                    .setPositiveButton("Close", null)
                    .show()
            }.show()
    }

    // Phase 11.45: read-only, server-verified pending upload review.
    // Never clears the pending marker or retries an upload automatically.
    private fun reviewPendingBookingSync(date: String) {
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified ||
            prefs.getString("bookingSyncPendingOwner", null) != owner.uid) {
            message("No pending cloud booking review for this account")
            return
        }
        val pendingJson = prefs.getString("bookingSyncPendingJson", null)
        val localJson = prefs.getString("bookings", "[]") ?: "[]"
        if (pendingJson == null || pendingJson != localJson) {
            AlertDialog.Builder(this).setTitle("Sync review · phone changed")
                .setMessage("The phone bookings changed since the pending upload. " +
                    "No upload was attempted. Review cloud differences before editing further.")
                .setPositiveButton("Close", null).show()
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                if (isFinishing || isDestroyed || currentScreen != "calendar" ||
                    selectedDate != date ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid ||
                    prefs.getString("bookingSyncPendingJson", null) != pendingJson ||
                    prefs.getString("bookings", null) != localJson) return@addOnSuccessListener
                val summary = try {
                    if (!snapshot.exists()) {
                        "No cloud booking snapshot exists. Your phone bookings remain saved. " +
                            "Do not assume they were uploaded."
                    } else {
                        check(snapshot.getLong("schemaVersion") == 1L) {
                            "Unsupported cloud booking schema"
                        }
                        val cloudJson = snapshot.getString("json")
                            ?: error("Missing cloud booking JSON")
                        val cloudItems = JSONArray(cloudJson)
                        val phoneItems = JSONArray(localJson)
                        if (cloudJson == localJson) {
                            "Cloud and phone booking snapshots match exactly " +
                                "(${phoneItems.length()} appointments). " +
                                "The previous upload acknowledgement remains unconfirmed."
                        } else {
                            "Cloud has ${cloudItems.length()} appointments; phone has " +
                                "${phoneItems.length()}. Their snapshots differ. " +
                                "Do not overwrite cloud data. Review differences first."
                        }
                    }
                } catch (_: Exception) {
                    "Cloud booking data could not be verified. No upload attempted."
                }
                AlertDialog.Builder(this).setTitle("Pending cloud sync · read only")
                    .setMessage(summary + " No upload, import or pending-status reset was performed.")
                    .setPositiveButton("Close", null).show()
            }.addOnFailureListener {
                if (!isFinishing && !isDestroyed && currentScreen == "calendar" &&
                    FirebaseAuth.getInstance().currentUser?.uid == owner.uid) {
                    AlertDialog.Builder(this).setTitle("Cloud unavailable")
                        .setMessage("Could not verify server bookings. Phone bookings remain " +
                            "saved; pending sync remains flagged. No upload attempted.")
                        .setPositiveButton("Close", null).show()
                }
            }
    }

    // Phase 11.48: manual conflict recovery guidance. Never writes or clears sync state.
    private fun previewConflictRecovery(date: String) {
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            message("Sign in with a verified account to review recovery options")
            return
        }
        val phoneJson = prefs.getString("bookings", "[]") ?: "[]"
        val pendingOwner = prefs.getString("bookingSyncPendingOwner", null)
        val pending = pendingOwner == owner.uid
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                if (isFinishing || isDestroyed || currentScreen != "calendar" ||
                    selectedDate != date ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid ||
                    prefs.getString("bookings", "[]") != phoneJson ||
                    (prefs.getString("bookingSyncPendingOwner", null) == owner.uid) != pending
                ) return@addOnSuccessListener
                val summary = try {
                    check(snapshot.exists() && snapshot.getLong("schemaVersion") == 1L) {
                        "Missing or unsupported cloud snapshot"
                    }
                    val cloud = JSONArray(snapshot.getString("json")
                        ?: error("Missing cloud JSON"))
                    val phone = JSONArray(phoneJson)
                    fun indexed(items: JSONArray): Map<String, JSONObject> {
                        val found = mutableMapOf<String, JSONObject>()
                        for (i in 0 until items.length()) {
                            val item = items.getJSONObject(i)
                            val id = item.optString("id")
                            check(id.isNotBlank() && found.put(id, item) == null) {
                                "Duplicate or invalid booking ID"
                            }
                        }
                        return found
                    }
                    val remote = indexed(cloud)
                    val local = indexed(phone)
                    val cloudOnly = remote.keys.count { it !in local }
                    val phoneOnly = local.keys.count { it !in remote }
                    val changed = remote.keys.intersect(local.keys).count {
                        remote[it].toString() != local[it].toString()
                    }
                    val baselineOwner = prefs.getString("bookingSyncAcknowledgedOwner", null)
                    val baseline = if (baselineOwner == owner.uid)
                        prefs.getString("bookingSyncAcknowledgedJson", null) else null
                    val baselineVerified = baseline != null
                    "Cloud-only: $cloudOnly; phone-only: $phoneOnly; " +
                        "same-ID differences: $changed. " +
                        "Pending cloud confirmation: ${if (pending) "yes" else "no"}. " +
                        "Previous acknowledged phone snapshot: " +
                        "${if (baselineVerified) "available" else "unavailable"}.\n\n" +
                        "Recovery guidance: review cloud differences first. " +
                        "Cloud-only appointments may be eligible for the separate " +
                        "confirmed additive import. Same-ID conflicts need manual " +
                        "review; no automatic overwrite or merge is offered. " +
                        "Phone-only appointments remain saved locally."
                } catch (_: Exception) {
                    "Cloud or phone data could not be verified. No recovery action is safe."
                }
                AlertDialog.Builder(this).setTitle("Conflict recovery · read only")
                    .setMessage(summary + "\n\nNo booking was changed, uploaded, " +
                        "imported or deleted. No pending marker was cleared.")
                    .setPositiveButton("Close", null).show()
            }.addOnFailureListener {
                if (!isFinishing && !isDestroyed && currentScreen == "calendar" &&
                    selectedDate == date &&
                    FirebaseAuth.getInstance().currentUser?.uid == owner.uid) {
                    AlertDialog.Builder(this).setTitle("Recovery unavailable")
                        .setMessage("Server verification failed. Your phone bookings " +
                            "are unchanged. No recovery action was attempted.")
                        .setPositiveButton("Close", null).show()
                }
            }
    }

    // Phase 11.49: establish an acknowledged baseline ONLY after verifying
    // identical full phone/cloud JSON from the server. No booking writes.
    private fun establishVerifiedBookingBaseline(date: String) {
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            message("Sign in with a verified account first")
            return
        }
        val phoneJson = prefs.getString("bookings", "[]") ?: "[]"
        if (prefs.getString("bookingSyncPendingOwner", null) == owner.uid) {
            message("Pending cloud sync must be reviewed first; baseline not changed")
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                if (isFinishing || isDestroyed || currentScreen != "calendar" ||
                    selectedDate != date ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid ||
                    prefs.getString("bookings", "[]") != phoneJson ||
                    prefs.getString("bookingSyncPendingOwner", null) == owner.uid
                ) return@addOnSuccessListener
                val result = try {
                    check(snapshot.exists() && snapshot.getLong("schemaVersion") == 1L) {
                        "Cloud snapshot unavailable or unsupported"
                    }
                    val serverJson = snapshot.getString("json")
                        ?: error("Missing cloud booking JSON")
                    val phone = JSONArray(phoneJson)
                    val cloud = JSONArray(serverJson)
                    fun validate(items: JSONArray) {
                        val seen = mutableSetOf<String>()
                        for (i in 0 until items.length()) {
                            val id = items.getJSONObject(i).optString("id")
                            check(id.isNotBlank() && seen.add(id)) {
                                "Invalid or duplicate booking ID"
                            }
                        }
                    }
                    validate(phone)
                    validate(cloud)
                    check(serverJson == phoneJson) {
                        "Phone and cloud snapshots differ. Review conflicts first."
                    }
                    // Commit only the verified exact server snapshot to the
                    // current account; never modify appointments or pending state.
                    prefs.edit()
                        .putString("bookingSyncAcknowledgedOwner", owner.uid)
                        .putString("bookingSyncAcknowledgedJson", serverJson).apply()
                    "Verified baseline saved for ${cloud.length()} appointments. " +
                        "No bookings were uploaded, imported, changed or deleted."
                } catch (_: Exception) {
                    "Baseline not saved. Cloud data was unavailable, invalid or " +
                        "different from the phone. Review cloud differences first."
                }
                AlertDialog.Builder(this).setTitle("Verified cloud baseline")
                    .setMessage(result).setPositiveButton("Close", null).show()
            }.addOnFailureListener {
                if (!isFinishing && !isDestroyed && currentScreen == "calendar" &&
                    selectedDate == date &&
                    FirebaseAuth.getInstance().currentUser?.uid == owner.uid) {
                    message("Server unavailable; baseline not saved")
                }
            }
    }

    // Phase 11.52: conservative status display, never an upload or retry.
    private fun showBookingSyncStatus(date: String) {
        section("BOOKING SYNC STATUS · READ ONLY")
        val status = label("Checking cloud confirmation…", 13f, muted)
        container.addView(status)
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            status.text = "Saved on this phone. Sign in with a verified account to check cloud status."
            return
        }
        val localJson = prefs.getString("bookings", "[]") ?: "[]"
        val pending = prefs.getString("bookingSyncPendingOwner", null) == owner.uid
        if (pending) {
            status.text = "Saved on phone · cloud confirmation pending review. " +
                "No automatic retry. Use Review pending cloud sync."
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                if (currentScreen != "calendar" || selectedDate != date ||
                    isFinishing || isDestroyed ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid ||
                    prefs.getString("bookings", "[]") != localJson ||
                    prefs.getString("bookingSyncPendingOwner", null) == owner.uid
                ) return@addOnSuccessListener
                status.text = try {
                    if (!snapshot.exists() || snapshot.getLong("schemaVersion") != 1L) {
                        "Saved on phone · no verified cloud booking snapshot."
                    } else {
                        val serverJson = snapshot.getString("json")
                            ?: error("Missing cloud booking data")
                        JSONArray(serverJson)
                        JSONArray(localJson)
                        if (serverJson == localJson) {
                            "Phone and cloud match · verified from server just now. " +
                                "No changes made."
                        } else {
                            "Saved on phone · cloud differs. Review cloud booking " +
                                "differences before editing. No changes made."
                        }
                    }
                } catch (_: Exception) {
                    "Saved on phone · cloud status could not be verified."
                }
            }.addOnFailureListener {
                if (currentScreen == "calendar" && selectedDate == date &&
                    !isFinishing && !isDestroyed &&
                    FirebaseAuth.getInstance().currentUser?.uid == owner.uid) {
                    status.text = "Saved on phone · cloud unavailable. Confirmation unknown."
                }
            }
    }

    // Phase 11.53: UI rehearsal is deliberately isolated from bookings and Firebase.
    private fun showIsolatedAppointmentEditRehearsal() {
        if (!BuildConfig.DEBUG) return
        val original = "09:00"
        val candidate = EditText(this).apply {
            setSingleLine(true)
            setText("09:30")
            hint = "HH:mm"
        }
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(12), dp(22), dp(12))
            addView(label("TEST APPOINTMENT ONLY · not saved to your calendar", 14f, dark, true))
            addView(label("Original: 09:00. Enter a new time to rehearse editing. " +
                "This screen does not access Firebase or your real appointments.", 13f, muted))
            addView(candidate)
        }
        AlertDialog.Builder(this)
            .setTitle("Isolated appointment edit rehearsal")
            .setView(form)
            .setPositiveButton("Validate test edit") { _, _ ->
                val proposed = candidate.text.toString().trim()
                val valid = Regex("([01][0-9]|2[0-3]):[0-5][0-9]").matches(proposed)
                AlertDialog.Builder(this)
                    .setTitle(if (valid) "Test edit validated" else "Invalid test time")
                    .setMessage(if (valid)
                        "Demo appointment: $original → $proposed. " +
                            "Validation only: no phone booking or cloud record was changed. " +
                            "Cloud acknowledgement was NOT tested in this rehearsal."
                    else "Use 24-hour HH:mm format, for example 09:30. " +
                        "No appointments were changed.")
                    .setPositiveButton("OK", null).show()
            }.setNegativeButton("Close", null).show()
    }

    /** Phase 11.57: read-only real-device verification; never creates or edits appointments. */
    private fun verifyDeviceCloudBookingsReadOnly(date: String) {
        if (!BuildConfig.DEBUG) return
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            AlertDialog.Builder(this).setTitle("Device sync verification")
                .setMessage("Sign in with a verified account before checking the cloud.")
                .setPositiveButton("OK", null).show()
            return
        }
        val localAtStart = prefs.getString("bookings", "[]") ?: "[]"
        if (prefs.getString("bookingSyncPendingOwner", null) == owner.uid) {
            AlertDialog.Builder(this).setTitle("Cloud confirmation pending")
                .setMessage("A phone edit is pending. This read-only check will not retry or clear it. Review pending cloud sync first.")
                .setPositiveButton("OK", null).show()
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                if (isFinishing || isDestroyed || currentScreen != "calendar" ||
                    selectedDate != date ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid ||
                    prefs.getString("bookings", "[]") != localAtStart ||
                    prefs.getString("bookingSyncPendingOwner", null) == owner.uid
                ) return@addOnSuccessListener
                val report = try {
                    check(snapshot.exists() && snapshot.getLong("schemaVersion") == 1L) {
                        "Cloud snapshot unavailable or unsupported"
                    }
                    val server = snapshot.getString("json") ?: error("Cloud JSON missing")
                    val phoneItems = JSONArray(localAtStart)
                    val cloudItems = JSONArray(server)
                    fun ids(items: JSONArray): Set<String> {
                        val result = mutableSetOf<String>()
                        for (i in 0 until items.length()) {
                            val id = items.getJSONObject(i).optString("id")
                            require(id.isNotBlank() && result.add(id)) { "Invalid or duplicate booking ID" }
                        }
                        return result
                    }
                    val phoneIds = ids(phoneItems)
                    val cloudIds = ids(cloudItems)
                    val equal = server == localAtStart
                    "Phone appointments: ${phoneItems.length()}\n" +
                        "Cloud appointments: ${cloudItems.length()}\n" +
                        "Cloud-only IDs: ${(cloudIds - phoneIds).size}\n" +
                        "Phone-only IDs: ${(phoneIds - cloudIds).size}\n" +
                        "Exact snapshot match: ${if (equal) "YES" else "NO"}\n\n" +
                        (if (equal) "Read-only server verification passed. No bookings changed."
                        else "Differences detected. Do not force sync or overwrite; review conflict recovery.")
                } catch (e: Exception) {
                    "Verification could not complete: ${e.message}. No changes made."
                }
                AlertDialog.Builder(this).setTitle("Phase 11.57 · Device/cloud check")
                    .setMessage(report).setPositiveButton("OK", null).show()
            }
            .addOnFailureListener {
                if (!isFinishing && !isDestroyed && currentScreen == "calendar" &&
                    selectedDate == date && FirebaseAuth.getInstance().currentUser?.uid == owner.uid) {
                    AlertDialog.Builder(this).setTitle("Cloud verification unavailable")
                        .setMessage("Server read failed. No changes or retries were made.")
                        .setPositiveButton("OK", null).show()
                }
            }
    }

    /** Phase 11.59: preparation only; no second-device writes or account changes. */
    private fun showTwoDeviceTestReadiness() {
        if (!BuildConfig.DEBUG) return
        val owner = FirebaseAuth.getInstance().currentUser
        val pending = owner != null &&
            prefs.getString("bookingSyncPendingOwner", null) == owner.uid
        val signedIn = owner != null && owner.isEmailVerified
        val phoneCount = try {
            JSONArray(prefs.getString("bookings", "[]") ?: "[]").length().toString()
        } catch (_: Exception) { "unavailable" }
        val status = when {
            !signedIn -> "NOT READY: sign in with a verified account."
            pending -> "NOT READY: a booking upload is pending review. Do not force sync."
            else -> "PREPARATION ONLY: check the cloud using the read-only verification button."
        }
        val instructions = "Current phone appointments: $phoneCount\n" +
            "Verified account: ${if (signedIn) "YES" else "NO"}\n" +
            "Pending cloud confirmation: ${if (pending) "YES" else "NO"}\n\n" +
            "$status\n\n" +
            "Before a two-phone test:\n" +
            "1. Keep this phone's installed app and its data intact.\n" +
            "2. Verify phone/cloud appointments on this phone.\n" +
            "3. Use a separate disposable test account and appointments for any write tests.\n" +
            "4. Do not edit, import, delete or force-sync existing appointments on either phone.\n" +
            "5. A matching read-only report on this phone does not prove the second phone is safe.\n\n" +
            "This checklist performs no cloud writes, retries or sign-ins."
        AlertDialog.Builder(this).setTitle("Phase 11.59 · Two-device preparation")
            .setMessage(instructions).setPositiveButton("OK", null).show()
    }

    /** Phase 11.60: one-phone, read-only local recovery audit. */
    private fun showSinglePhoneRecoveryAudit() {
        if (!BuildConfig.DEBUG) return
        val owner = FirebaseAuth.getInstance().currentUser
        val verified = owner != null && owner.isEmailVerified
        val pending = owner != null &&
            prefs.getString("bookingSyncPendingOwner", null) == owner.uid
        val raw = prefs.getString("bookings", "[]") ?: "[]"
        val result = try {
            val bookings = JSONArray(raw)
            val ids = mutableSetOf<String>()
            for (index in 0 until bookings.length()) {
                val id = bookings.getJSONObject(index).optString("id")
                require(id.isNotBlank() && ids.add(id)) { "Missing or duplicate appointment ID" }
            }
            "Local appointment count: ${bookings.length()}\n" +
                "Local IDs valid: YES\n" +
                "Verified account: ${if (verified) "YES" else "NO"}\n" +
                "Cloud upload pending: ${if (pending) "YES" else "NO"}\n\n" +
                (if (!verified || pending)
                    "NOT READY: do not attempt cloud recovery or force sync."
                else "Local snapshot is readable. Use the separate read-only server verification button to check cloud agreement.") +
                "\n\nNo bookings were modified or uploaded."
        } catch (_: Exception) {
            "Local appointment snapshot is invalid. Do not force sync or overwrite cloud data.\n\nNo changes made."
        }
        AlertDialog.Builder(this).setTitle("Phase 11.60 · Single-phone recovery audit")
            .setMessage(result).setPositiveButton("OK", null).show()
    }

    /** Phase 11.61: on-demand diagnostics only; never changes appointments. */
    private fun diagnoseBookingRecoveryReadOnly(date: String) {
        if (!BuildConfig.DEBUG) return
        val owner = FirebaseAuth.getInstance().currentUser
        if (owner == null || !owner.isEmailVerified) {
            AlertDialog.Builder(this).setTitle("Phase 11.61 · Recovery diagnostics")
                .setMessage("Sign in with a verified account. No changes made.")
                .setPositiveButton("OK", null).show()
            return
        }
        val localAtStart = prefs.getString("bookings", "[]") ?: "[]"
        if (prefs.getString("bookingSyncPendingOwner", null) == owner.uid) {
            AlertDialog.Builder(this).setTitle("Phase 11.61 · Recovery diagnostics")
                .setMessage("ACTION NEEDED: cloud confirmation is pending. Do not force sync. No changes made.")
                .setPositiveButton("OK", null).show()
            return
        }
        FirebaseFirestore.getInstance().collection("users").document(owner.uid)
            .collection("liveData").document("bookings").get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                if (isFinishing || isDestroyed || currentScreen != "calendar" ||
                    selectedDate != date ||
                    FirebaseAuth.getInstance().currentUser?.uid != owner.uid ||
                    prefs.getString("bookings", "[]") != localAtStart ||
                    prefs.getString("bookingSyncPendingOwner", null) == owner.uid
                ) return@addOnSuccessListener
                val report = try {
                    fun readIds(raw: String): Set<String> {
                        val array = JSONArray(raw)
                        val ids = mutableSetOf<String>()
                        for (index in 0 until array.length()) {
                            val id = array.getJSONObject(index).optString("id")
                            require(id.isNotBlank() && ids.add(id)) { "Missing or duplicate appointment ID" }
                        }
                        return ids
                    }
                    check(snapshot.exists() && snapshot.getLong("schemaVersion") == 1L) {
                        "Cloud snapshot missing or unsupported"
                    }
                    val cloud = snapshot.getString("json") ?: error("Cloud booking JSON missing")
                    val localIds = readIds(localAtStart)
                    val cloudIds = readIds(cloud)
                    when {
                        cloud == localAtStart ->
                            "HEALTHY: phone and cloud snapshots match exactly.\nAppointments: ${localIds.size}"
                        else ->
                            "ACTION NEEDED: phone and cloud differ.\n" +
                            "Phone-only IDs: ${(localIds - cloudIds).size}\n" +
                            "Cloud-only IDs: ${(cloudIds - localIds).size}\n" +
                            "Matching IDs with possible changes: ${localIds.intersect(cloudIds).size}\n" +
                            "Review conflicts before any further editing. Do not force sync."
                    }
                } catch (_: Exception) {
                    "ACTION NEEDED: booking snapshot could not be verified. Do not force sync."
                }
                AlertDialog.Builder(this).setTitle("Phase 11.61 · Recovery diagnostics")
                    .setMessage(report + "\n\nRead-only server check. No bookings changed.")
                    .setPositiveButton("OK", null).show()
            }
            .addOnFailureListener {
                if (!isFinishing && !isDestroyed && currentScreen == "calendar" &&
                    selectedDate == date && FirebaseAuth.getInstance().currentUser?.uid == owner.uid) {
                    AlertDialog.Builder(this).setTitle("Phase 11.61 · Recovery diagnostics")
                        .setMessage("CLOUD UNAVAILABLE: cannot verify server. No retries or changes made.")
                        .setPositiveButton("OK", null).show()
                }
            }
    }

    private fun showCalendar() {
        screen("Calendar", "A clear view of your working day.", "calendar")
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
        val dateNavigationCard = panel()
        dateNavigationCard.addView(label("SELECTED DATE", 11f, muted, true))
        dateNavigationCard.addView(navigation, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8)
        })
        addPanel(dateNavigationCard)
        val week = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for (offset in -3..3) {
            val date = shiftDate(selectedDate, offset)
            val selected = offset == 0
            val cell = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(dp(2), dp(10), dp(2), dp(10))
                background = rounded(if (selected) orange else Color.WHITE, 16)
                isClickable = true
                isFocusable = true
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
        button("Jump to date") {
            pickDate(selectedDate) { selectedDate = it; showCalendar() }
        }
        button("+ New appointment") { bookingDialog(defaultDate = selectedDate) }
        showBookingSyncStatus(selectedDate)
        // Phase 11.42: never mistake a locally saved booking for a cloud-confirmed one.
        val pendingOwner = FirebaseAuth.getInstance().currentUser?.uid
        if (pendingOwner != null &&
            prefs.getString("bookingSyncPendingOwner", null) == pendingOwner) {
            section("Cloud sync needs review · phone bookings preserved")
            container.addView(label(
                "A previous cloud upload was not confirmed. Your appointments are saved " +
                    "on this phone. Review cloud booking differences before taking action. " +
                    "Nothing will be uploaded automatically on reconnect.",
                13f, muted))
            button("Review pending cloud sync · read only") {
                reviewPendingBookingSync(selectedDate)
            }
        }

        val daily = bookings.filter { it.date == selectedDate }.sortedBy { it.time }
        val summary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = rounded(orange, 24)
        }
        summary.addView(label("YOUR SCHEDULE  •  TODAY AT A GLANCE", 12f, Color.WHITE, true))
        summary.addView(label("${daily.size} appointment${if (daily.size == 1) "" else "s"}",
            26f, Color.WHITE, true))
        summary.addView(label(displayDate(selectedDate), 14f, Color.WHITE))
        // Phase 11.65: display both source counts, never combine or import them.
        val websiteOverviewStatus = label("Website bookings: checking separate feed…", 13f, Color.WHITE)
        summary.addView(websiteOverviewStatus)
        container.addView(summary, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(6)
            bottomMargin = dp(12)
        })
        if (BuildConfig.DEBUG) {
            showDebugWebsiteBookingPreview(selectedDate)
        }
        showSharedCloudAppointments(selectedDate, websiteOverviewStatus)
        showLegacyMultiDeviceReadiness(selectedDate)
        showCloudBookingDifferences(selectedDate)
        button("Review conflict recovery · read only") {
            previewConflictRecovery(selectedDate)
        }
        button("Verify matching cloud baseline · no booking changes") {
            establishVerifiedBookingBaseline(selectedDate)
        }
        button("Review cloud-only appointment import") { previewCloudOnlyImport(selectedDate) }
        if (BuildConfig.DEBUG) {
            button("Demo recovery rehearsal · no real changes") {
                showIsolatedRecoveryRehearsal(selectedDate)
            }
            button("Recovery diagnostics · read only") {
                diagnoseBookingRecoveryReadOnly(selectedDate)
            }
            button("Single-phone recovery audit · read only") {
                showSinglePhoneRecoveryAudit()
            }
            button("Two-device test readiness · no changes") {
                showTwoDeviceTestReadiness()
            }
            button("Verify device/cloud appointments · read only") {
                verifyDeviceCloudBookingsReadOnly(selectedDate)
            }
            button("Demo appointment edit · no real changes") {
                showIsolatedAppointmentEditRehearsal()
            }
            button("Demo offline reconnect · no real changes") {
                showOfflineReconnectRehearsal(selectedDate)
            }
        }
        section("Appointments · saved on this phone")
        if (daily.isEmpty()) {
            val empty = panel()
            empty.addView(label("No appointments scheduled", 19f, dark, true))
            empty.addView(label("This date is free. Add an appointment to get started.", 14f, muted))
            addPanel(empty)
        } else {
            daily.forEach { bookingCard(it) }
        }
        button("Today") { selectedDate = today(); showCalendar() }
        button("Back to Dashboard") { showDashboard() }
    }

    /** Development-only website calendar feed. No synthetic bookings or production writes. */
    private fun showDebugWebsiteBookingPreview(date: String) {
        section("WEBSITE BOOKINGS • EMULATOR ONLY • PHASE 11.13")
        val preview = panel()
        val status = label("Emulator not connected • no website bookings loaded", 13f, muted)
        val results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        preview.addView(status)
        preview.addView(results)
        addPanel(preview)
        if (debugCalendarSource == null) {
            debugCalendarSource = runCatching {
                Class.forName("com.salonbook.pro.debug.DebugCalendarSource")
                    .getDeclaredConstructor(android.content.Context::class.java)
                    .newInstance(this) as DevelopmentCalendarSource
            }.getOrNull()
        }
        debugCalendarSource?.display(date) { state ->
            if (currentScreen != "calendar" || selectedDate != date || !BuildConfig.DEBUG) return@display
            status.text = state.message
            results.removeAllViews()
            state.items.distinctBy { it.id }.forEach { item ->
                results.addView(label("${item.time} • ${item.service} • ${item.staff}", 15f, dark, true))
                results.addView(label(item.status.uppercase(Locale.UK), 12f,
                    if (item.status == "confirmed") orange else muted, true))
            }
        }
    }

    private fun showAppointments() {
        screen("All appointments", "Your complete booking history, beautifully organised.", "appointments")
        val sorted = bookings.sortedWith(compareBy<Booking> { it.date }.thenBy { it.time })
        val overview = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(20))
            background = rounded(orange, 24)
        }
        overview.addView(label("APPOINTMENT OVERVIEW  •  BOUSTIO", 12f, Color.WHITE, true))
        overview.addView(label("${sorted.size} booking${if (sorted.size == 1) "" else "s"}",
            29f, Color.WHITE, true), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8)
        })
        overview.addView(label("Your saved appointments, in date and time order.",
            13f, Color.WHITE), LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(5)
        })
        container.addView(overview, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8)
            bottomMargin = dp(12)
        })
        button("+ Create New Booking") { bookingDialog() }
        if (sorted.isEmpty()) {
            val emptyCard = panel()
            emptyCard.addView(label("No appointments yet", 18f, dark, true))
            emptyCard.addView(label("Your saved bookings will appear here when you add them.",
                13f, muted))
            addPanel(emptyCard)
        } else {
            section("Your bookings")
            sorted.forEach { bookingCard(it) }
        }
        button("Back to Dashboard") { showDashboard() }
    }

    private fun bookingCard(booking: Booking) {
        val card = panel()
        // Phase 12.8: read-only premium appointment card; booking records are unchanged.
        val staff = readRecords("staff").firstOrNull { it.optString("id") == booking.staffId }
        val end = if (booking.duration > 0) {
            runCatching { " – ${formatTime(toMinutes(booking.time) + booking.duration)}" }
                .getOrDefault("")
        } else ""
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val accent = View(this).apply { background = rounded(orange, 3) }
        top.addView(accent, LinearLayout.LayoutParams(dp(4), dp(46)).apply {
            marginEnd = dp(12)
        })
        val schedule = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        schedule.addView(label("APPOINTMENT TIME", 11f, muted, true))
        schedule.addView(label("${booking.time}$end", 18f, orange, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(3) })
        top.addView(schedule, LinearLayout.LayoutParams(0, -2, 1f))
        card.addView(top)
        val divider = View(this).apply { setBackgroundColor(lightBorder) }
        card.addView(divider, LinearLayout.LayoutParams(-1, dp(1)).apply {
            topMargin = dp(14)
            bottomMargin = dp(14)
        })
        card.addView(label(booking.client, 22f, dark, true))
        card.addView(label(booking.service, 15f, muted),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })
        card.addView(label(displayDate(booking.date), 13f, muted),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(9) })
        if (staff != null) card.addView(label("With ${staff.optString("name")}", 13f, muted))
        if (booking.duration > 0) card.addView(label("${booking.duration} minute appointment", 13f, muted))
        if (booking.price.isNotBlank()) {
            val priceRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(14), dp(10), dp(14), dp(10))
                background = rounded(paleOrange, 14)
            }
            priceRow.addView(label("SERVICE PRICE", 11f, orange, true),
                LinearLayout.LayoutParams(0, -2, 1f))
            priceRow.addView(label("£${booking.price}", 20f, orange, true))
            card.addView(priceRow, LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = dp(14)
            })
        }
        if (booking.notes.isNotBlank()) card.addView(label("Notes: ${booking.notes}", 13f, muted),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
        card.addView(Button(this).apply {
            text = "Edit / Cancel"
            styleButton(this)
            setOnClickListener { bookingOptions(booking) }
        }, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14) })
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
            setPadding(dp(20), dp(12), dp(20), dp(16))
            setBackgroundColor(this@MainActivity.background)
        }
        fun section(heading: String, description: String): LinearLayout {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(14), dp(16), dp(16))
                background = GradientDrawable().apply {
                    setColor(Color.WHITE)
                    cornerRadius = dp(18).toFloat()
                    setStroke(dp(1), lightBorder)
                }
            }
            card.addView(label(heading, 17f, dark, true))
            card.addView(label(description, 12f, muted), LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = dp(4); bottomMargin = dp(8)
            })
            form.addView(card, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
            return card
        }
        fun field(parent: LinearLayout, hintText: String, value: String = ""): EditText =
            EditText(this).apply {
                hint = hintText
                setSingleLine(true)
                setText(value)
                setTextColor(dark)
                textSize = 15f
                backgroundTintList = ColorStateList.valueOf(orange)
                parent.addView(this, LinearLayout.LayoutParams(-1, -2))
            }
        // Phase 12.9: visual-only introduction; existing form validation and persistence remain intact.
        val formIntro = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(18))
            background = rounded(paleOrange, 20)
        }
        formIntro.addView(label("BOUSTIO  •  APPOINTMENTS", 11f, orange, true))
        formIntro.addView(label(if (existing == null) "Create an appointment" else "Update appointment details",
            21f, dark, true), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(7) })
        formIntro.addView(label("Four simple steps to organise your client's visit.",
            13f, muted), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
        form.addView(formIntro, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(14) })
        val clientCard = section("01  Client details", "Who is this appointment for?")
        val client = field(clientCard, "Client name", existing?.client ?: "")
        val knownClients = (bookings.map { it.client.trim() } + registeredClients()).filter { it.isNotBlank() }
            .distinct().sorted()
        if (knownClients.isNotEmpty()) {
            val chooseClient = Button(this).apply {
                text = "Choose existing client  ▾"
                styleButton(this, false)
            }
            clientCard.addView(chooseClient, LinearLayout.LayoutParams(-1, dp(44)))
            chooseClient.setOnClickListener {
                AlertDialog.Builder(this).setTitle("Existing clients")
                    .setItems(knownClients.toTypedArray()) { _, index ->
                        client.setText(knownClients[index])
                    }.show()
            }
        }
        val notes = field(clientCard, "Notes (optional)", existing?.notes ?: "")
        val serviceCard = section("02  Service & professional", "Choose the treatment and team member")
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
        serviceCard.addView(label("Service", 13f, muted, true))
        serviceCard.addView(serviceSpinner, LinearLayout.LayoutParams(-1, dp(48)))
        val staffSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item,
                staff.map { "${it.optString("name")} · ${it.optString("role")}" })
            val index = staff.indexOfFirst { it.optString("id") == existing?.staffId }
            if (index >= 0) setSelection(index)
        }
        serviceCard.addView(label("Staff member", 13f, muted, true))
        serviceCard.addView(staffSpinner, LinearLayout.LayoutParams(-1, dp(48)))
        val whenCard = section("03  Date & time", "Select when the client will visit")
        var date = existing?.date ?: defaultDate
        var time = existing?.time ?: "09:00"
        fun displayBookingDate(iso: String): String = try {
            val parser = SimpleDateFormat("yyyy-MM-dd", Locale.UK).apply { isLenient = false }
            val formatter = SimpleDateFormat("EEEE d MMMM yyyy", Locale.UK)
            formatter.format(parser.parse(iso)!!)
        } catch (_: Exception) { iso }
        fun premiumPicker(textValue: String): Button = Button(this).apply {
            text = textValue
            textSize = 13f
            isAllCaps = false
            setSingleLine(true)
            ellipsize = android.text.TextUtils.TruncateAt.END
            gravity = Gravity.CENTER_VERTICAL or Gravity.START
            setPadding(dp(16), 0, dp(12), 0)
            setTextColor(orange)
            background = GradientDrawable().apply {
                setColor(paleOrange)
                cornerRadius = dp(12).toFloat()
                setStroke(dp(1), orange)
            }
        }
        var refreshChoices: () -> Unit = {}
        val dateButton = premiumPicker("▦  ${displayBookingDate(date)}")
        dateButton.contentDescription = "Choose appointment date"
        dateButton.setOnClickListener {
            pickDate(date) { date = it; dateButton.text = "▦  ${displayBookingDate(date)}"; refreshChoices() }
        }
        whenCard.addView(dateButton, LinearLayout.LayoutParams(-1, dp(54)).apply { bottomMargin = dp(10) })
        val timeButton = premiumPicker("◷   $time")
        timeButton.contentDescription = "Choose appointment time"
        timeButton.setOnClickListener {
            val parts = time.split(":")
            TimePickerDialog(this, { _, hour, minute ->
                time = String.format(Locale.UK, "%02d:%02d", hour, minute)
                timeButton.text = "◷   $time"
                refreshChoices()
            }, parts[0].toInt(), parts[1].toInt(), true).show()
        }
        whenCard.addView(timeButton, LinearLayout.LayoutParams(-1, dp(54)))
        val slotTitle = label("Available start times", 13f, dark, true)
        whenCard.addView(slotTitle, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14) })
        val slotGrid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        whenCard.addView(slotGrid)
        val summaryCard = section("04  Booking summary", "Review the appointment before saving")
        val summary = label("", 14f, dark)
        summaryCard.addView(summary)
        fun refreshBookingChoices() {
            val service = services[serviceSpinner.selectedItemPosition.coerceIn(0, services.lastIndex)]
            val member = staff[staffSpinner.selectedItemPosition.coerceIn(0, staff.lastIndex)]
            val duration = service.optInt("duration", 0)
            val staffId = member.optString("id")
            summary.text = "${service.optString("name")}  ·  £${service.optString("price")}\n" +
                "${member.optString("name")}  ·  $duration minutes\n" +
                "${displayBookingDate(date)} at $time"
            slotGrid.removeAllViews()
            if (duration <= 0) {
                slotGrid.addView(label("Set a valid service duration to see times.", 12f, muted))
                return
            }
            val options = (0 until 1440 step 30).filter { start ->
                start + duration <= 1440 &&
                    withinWorkingHours(member, date, start, start + duration) &&
                    bookings.none { other ->
                        other.id != existing?.id && other.date == date &&
                            other.staffId == staffId && other.duration > 0 &&
                            start < toMinutes(other.time) + other.duration &&
                            toMinutes(other.time) < start + duration
                    }
            }
            if (options.isEmpty()) {
                slotGrid.addView(label("No available slots for this staff member on this date.", 12f, muted))
            } else {
                options.chunked(3).forEach { group ->
                    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                    group.forEach { start ->
                        val choice = Button(this).apply {
                            text = formatTime(start)
                            textSize = 12f
                            isAllCaps = false
                            setTextColor(orange)
                            backgroundTintList = ColorStateList.valueOf(paleOrange)
                            setOnClickListener {
                                time = formatTime(start)
                                timeButton.text = "◷   $time"
                                refreshBookingChoices()
                            }
                        }
                        row.addView(choice, LinearLayout.LayoutParams(0, dp(46), 1f).apply {
                            marginEnd = dp(4)
                        })
                    }
                    slotGrid.addView(row)
                }
            }
        }
        serviceSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                refreshBookingChoices()
            }
        }
        staffSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                refreshBookingChoices()
            }
        }
        refreshChoices = { refreshBookingChoices() }
        refreshBookingChoices()
        form.addView(label("Availability and overlap checks run when you save.", 12f, muted))
        val dialog = AlertDialog.Builder(this)
            .setTitle(if (existing == null) "New Appointment" else "Edit Appointment")
            .setView(ScrollView(this).apply { addView(form) })
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(orange)
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(muted)
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
                if (!withinWorkingHours(member, date, start, start + duration)) {
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

    private fun withinWorkingHours(member: JSONObject, date: String, start: Int, end: Int): Boolean {
        val schedule = member.optJSONObject("weeklySchedule")
        if (schedule != null) {
            val parsed = runCatching {
                SimpleDateFormat("yyyy-MM-dd", Locale.UK).apply { isLenient = false }.parse(date)
            }.getOrNull() ?: return false
            val day = listOf("sunday", "monday", "tuesday", "wednesday",
                "thursday", "friday", "saturday")[
                Calendar.getInstance().apply { time = parsed }.get(Calendar.DAY_OF_WEEK) - 1
            ]
            val period = schedule.optJSONObject(day) ?: return false
            val from = runCatching { toMinutes(period.getString("open")) }.getOrNull() ?: return false
            val until = runCatching { toMinutes(period.getString("close")) }.getOrNull() ?: return false
            return from in 0..1439 && until in 1..1440 && from < until &&
                start >= from && end <= until
        }
        return withinWorkingHours(member.optString("hours"), date, start, end)
    }

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

    private fun clientProfileKey(name: String): String =
        "client_profile_" + name.trim().lowercase(Locale.UK)

    private fun clientCloudDocument(name: String): com.google.firebase.firestore.DocumentReference? {
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null || !user.isEmailVerified) return null
        val normalized = name.trim().lowercase(Locale.UK)
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(normalized.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return FirebaseFirestore.getInstance().collection("users").document(user.uid)
            .collection("clientProfiles").document(digest)
    }

    // The baseline is scoped to the signed-in Firebase UID, never shared between accounts.
    private fun clientSyncBaselineKey(name: String): String? {
        val user = FirebaseAuth.getInstance().currentUser ?: return null
        if (!user.isEmailVerified) return null
        return "client_sync_baseline_${user.uid}_" + clientProfileKey(name)
    }

    private fun clientFields(phone: String, email: String, notes: String): String =
        JSONObject().apply {
            put("phone", phone)
            put("email", email)
            put("notes", notes)
        }.toString()

    private fun autoSyncClient(name: String, local: JSONObject, status: TextView) {
        val ref = clientCloudDocument(name)
        val baselineKey = clientSyncBaselineKey(name)
        if (ref == null || baselineKey == null) {
            status.text = "Saved locally — sign in with a verified account for cloud sync"
            return
        }
        val phone = local.optString("phone")
        val email = local.optString("email")
        val notes = local.optString("notes")
        if (name.trim().length > 150 || phone.length > 50 ||
            email.length > 254 || notes.length > 5000) {
            status.text = "Saved locally — client details exceed cloud limits"
            return
        }
        val localFields = clientFields(phone, email, notes)
        val baseline = prefs.getString(baselineKey, null)
        val expectedUid = FirebaseAuth.getInstance().currentUser?.uid
        status.text = "Checking cloud version…"
        FirebaseFirestore.getInstance().runTransaction { transaction ->
            val remote = transaction.get(ref)
            if (remote.exists()) {
                if (!remote.getString("name").orEmpty().equals(name.trim(), ignoreCase = true)) {
                    throw IllegalStateException("Cloud profile identity mismatch")
                }
                val remoteFields = clientFields(
                    remote.getString("phone").orEmpty(),
                    remote.getString("email").orEmpty(),
                    remote.getString("notes").orEmpty()
                )
                if (remoteFields != localFields) {
                    if (baseline == null || remoteFields != baseline) {
                        throw IllegalStateException("Cloud conflict: use manual restore or backup after reviewing both versions")
                    }
                } else {
                    return@runTransaction Unit
                }
            } else if (baseline != null) {
                throw IllegalStateException("Cloud profile missing: automatic overwrite blocked")
            }
            transaction.set(ref, mapOf(
                "name" to name.trim(), "phone" to phone, "email" to email,
                "notes" to notes, "schemaVersion" to 1,
                "updatedAt" to FieldValue.serverTimestamp()
            ))
            Unit
        }.addOnSuccessListener {
            if (FirebaseAuth.getInstance().currentUser?.uid == expectedUid) {
                prefs.edit().putString(baselineKey, localFields).apply()
                status.text = "Saved locally and synced to cloud"
            } else {
                status.text = "Account changed — verify cloud status"
            }
        }.addOnFailureListener { error ->
            status.text = "Saved locally; cloud sync not completed: ${error.localizedMessage}"
        }
    }

    private fun showClientProfile(name: String) {
        screen("Client profile", "Everything about your client, in one place.", "client_profile")
        val key = clientProfileKey(name)
        val saved = runCatching {
            JSONObject(prefs.getString(key, "{}") ?: "{}")
        }.getOrDefault(JSONObject())
        val history = bookings.filter { it.client.trim().equals(name.trim(), ignoreCase = true) }
            .sortedWith(compareByDescending<Booking> { it.date }.thenByDescending { it.time })
        // Phase 12.10: presentation-only profile overview, no client or booking mutations.
        val overview = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = rounded(paleOrange, 20)
        }
        overview.addView(label("BOUSTIO  •  CLIENT CARE", 11f, orange, true))
        overview.addView(label("A clearer view of every client", 20f, dark, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(7) })
        overview.addView(label("Contact details, secure profile tools and visit history in one place.",
            13f, muted), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
        container.addView(overview, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8)
            bottomMargin = dp(12)
        })
        val card = panel()
        val identity = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val avatar = label(name.trim().take(1).uppercase(Locale.UK), 24f, orange, true).apply {
            gravity = Gravity.CENTER
            background = rounded(paleOrange, 22)
        }
        identity.addView(avatar, LinearLayout.LayoutParams(dp(64), dp(64)).apply {
            marginEnd = dp(16)
        })
        val heading = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        heading.addView(label("CLIENT PROFILE", 12f, orange, true))
        heading.addView(label(name, 22f, dark, true))
        heading.addView(label("${history.size} appointment${if (history.size == 1) "" else "s"}", 13f, muted))
        identity.addView(heading, LinearLayout.LayoutParams(0, -2, 1f))
        card.addView(identity)
        addPanel(card)
        section("Contact details")
        container.addView(label("Private information, available when you need it.", 13f, muted))
        val contact = panel()
        contact.addView(label("PRIVATE CLIENT INFORMATION", 11f, orange, true))
        contact.addView(label("Only save details your business needs to provide its services.",
            12f, muted), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5); bottomMargin = dp(8) })
        // Phase 12.12: persistent labels stay visible even when fields contain values.
        fun input(hint: String, value: String): EditText {
            contact.addView(label(hint.uppercase(Locale.UK), 12f, muted, true),
                LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
            return EditText(this).apply {
                this.hint = hint
                contentDescription = hint
                setText(value)
                setSingleLine(true)
                textSize = 15f
                setTextColor(dark)
                backgroundTintList = ColorStateList.valueOf(orange)
                contact.addView(this, LinearLayout.LayoutParams(-1, -2))
            }
        }
        val editableName = input("Client name", name)
        editableName.isEnabled = history.isEmpty() && registeredClients().any {
            it.equals(name, ignoreCase = true)
        }
        if (!editableName.isEnabled) {
            contact.addView(label("Name changes are disabled for clients with appointment history or without a manual client record, to protect existing bookings.", 12f, muted))
        }
        val phone = input("Phone number", saved.optString("phone"))
        phone.inputType = android.text.InputType.TYPE_CLASS_PHONE
        val email = input("Email address", saved.optString("email"))
        email.inputType = android.text.InputType.TYPE_CLASS_TEXT or
            android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        val notes = input("Client notes", saved.optString("notes"))
        addPanel(contact)
        section("Secure cloud profile")
        container.addView(label("CLOUD ACTIONS  •  REVIEW BEFORE RESTORING", 11f, orange, true))
        val cloudStatus = label("Changes sync when you save. Cloud conflicts require manual review.", 13f, muted)
        container.addView(cloudStatus)
        button("Save Client Details") {
            val updatedName = editableName.text.toString().trim()
            val phoneValue = phone.text.toString().trim()
            val emailValue = email.text.toString().trim()
            val notesValue = notes.text.toString().trim()
            if (updatedName.isBlank() || updatedName.length > 150 ||
                phoneValue.length > 50 || emailValue.length > 254 || notesValue.length > 5000) {
                message("Check client name and contact detail lengths")
                return@button
            }
            val data = JSONObject().apply {
                put("phone", phoneValue)
                put("email", emailValue)
                put("notes", notesValue)
            }
            if (!updatedName.equals(name, ignoreCase = true)) {
                if (!editableName.isEnabled || history.isNotEmpty() ||
                    bookings.any { it.client.equals(name, ignoreCase = true) }) {
                    message("Cannot rename a client linked to appointments")
                    return@button
                }
                if ((registeredClients() + bookings.map { it.client }).any {
                        it.equals(updatedName, ignoreCase = true) }) {
                    message("Another client already uses that name")
                    return@button
                }
                val records = JSONArray(prefs.getString("manual_clients", "[]") ?: "[]")
                var found = false
                for (i in 0 until records.length()) {
                    val record = records.optJSONObject(i) ?: continue
                    if (record.optString("name").equals(name, ignoreCase = true)) {
                        record.put("name", updatedName)
                        found = true
                    }
                }
                if (!found) {
                    message("Client record missing; rename cancelled")
                    return@button
                }
                val newKey = clientProfileKey(updatedName)
                if (prefs.contains(newKey)) {
                    message("A profile already exists under that name")
                    return@button
                }
                val committed = prefs.edit()
                    .putString("manual_clients", records.toString())
                    .putString(newKey, data.toString())
                    .remove(key)
                    .commit()
                if (!committed) {
                    message("Unable to save renamed client")
                    return@button
                }
                cloudStatus.text = "Renamed locally. Previous cloud profile remains unchanged; cloud rename requires separate verification."
                message("Client renamed locally")
                showClients()
            } else {
                if (!prefs.edit().putString(key, data.toString()).commit()) {
                    message("Unable to save client details")
                    return@button
                }
                autoSyncClient(name, data, cloudStatus)
            }
        }
        button("Back Up This Client to Cloud") {
            val ref = clientCloudDocument(name)
            if (ref == null) {
                message("Sign in with a verified email to use cloud profiles")
            } else {
                val phoneValue = phone.text.toString().trim()
                val emailValue = email.text.toString().trim()
                val notesValue = notes.text.toString().trim()
                if (name.length > 150 || phoneValue.length > 50 ||
                    emailValue.length > 254 || notesValue.length > 5000) {
                    message("Client details exceed cloud field limits")
                } else {
                    ref.get(Source.SERVER).addOnSuccessListener { snapshot ->
                        val proceed = {
                            val data = mapOf(
                                "name" to name.trim(),
                                "phone" to phoneValue,
                                "email" to emailValue,
                                "notes" to notesValue,
                                "schemaVersion" to 1,
                                "updatedAt" to FieldValue.serverTimestamp()
                            )
                            ref.set(data).addOnSuccessListener {
                                clientSyncBaselineKey(name)?.let { baselineKey ->
                                    prefs.edit().putString(baselineKey,
                                        clientFields(phoneValue, emailValue, notesValue)).apply()
                                }
                                cloudStatus.text = "Cloud backup confirmed"
                                message("Cloud backup confirmed for $name")
                            }.addOnFailureListener { error ->
                                message("Cloud backup failed: ${error.localizedMessage}")
                            }
                        }
                        if (snapshot.exists()) {
                            AlertDialog.Builder(this)
                                .setTitle("Replace cloud client profile?")
                                .setMessage("A cloud profile already exists for $name. Replace it with the details currently on this screen?")
                                .setPositiveButton("Replace") { _, _ -> proceed() }
                                .setNegativeButton("Cancel", null).show()
                        } else {
                            AlertDialog.Builder(this)
                                .setTitle("Back up client?")
                                .setMessage("Upload $name's contact details and notes to your private Firebase account?")
                                .setPositiveButton("Back Up") { _, _ -> proceed() }
                                .setNegativeButton("Cancel", null).show()
                        }
                    }.addOnFailureListener { error ->
                        message("Cloud verification failed: ${error.localizedMessage}")
                    }
                }
            }
        }
        button("Restore This Client from Cloud") {
            val ref = clientCloudDocument(name)
            if (ref == null) {
                message("Sign in with a verified email to restore")
            } else {
                ref.get(Source.SERVER).addOnSuccessListener { snapshot ->
                    if (!snapshot.exists()) {
                        message("No cloud profile found for $name")
                    } else if (!snapshot.getString("name").orEmpty()
                            .equals(name.trim(), ignoreCase = true)) {
                        message("Cloud profile name mismatch; restore cancelled")
                    } else {
                        AlertDialog.Builder(this)
                            .setTitle("Restore cloud client?")
                            .setMessage("This will replace locally saved contact details and notes for $name. Continue?")
                            .setPositiveButton("Restore") { _, _ ->
                                val restored = JSONObject().apply {
                                    put("phone", snapshot.getString("phone").orEmpty())
                                    put("email", snapshot.getString("email").orEmpty())
                                    put("notes", snapshot.getString("notes").orEmpty())
                                }
                                prefs.edit().putString(key, restored.toString()).apply()
                                clientSyncBaselineKey(name)?.let { baselineKey ->
                                    prefs.edit().putString(baselineKey,
                                        clientFields(restored.optString("phone"),
                                            restored.optString("email"),
                                            restored.optString("notes"))).apply()
                                }
                                cloudStatus.text = "Cloud profile restored"
                                phone.setText(restored.optString("phone"))
                                email.setText(restored.optString("email"))
                                notes.setText(restored.optString("notes"))
                                message("Cloud client restored")
                            }
                            .setNegativeButton("Cancel", null).show()
                    }
                }.addOnFailureListener { error ->
                    message("Cloud restore failed: ${error.localizedMessage}")
                }
            }
        }
        section("Appointment history")
        container.addView(label("VISIT HISTORY  •  ${history.size} APPOINTMENT${if (history.size == 1) "" else "S"}",
            11f, orange, true))
        container.addView(label("Previous visits, shown newest first.", 13f, muted))
        if (history.isEmpty()) text("No appointments recorded.")
        history.forEach { bookingCard(it) }
        button("Back to Clients") { showClients() }
    }

    private fun registeredClients(): List<String> = readRecords("manual_clients")
        .map { it.optString("name").trim() }.filter { it.isNotBlank() }

    private fun registerClientDialog() {
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), dp(8))
        }
        fun field(hintText: String): EditText = EditText(this).apply {
            hint = hintText
            setSingleLine(true)
            setTextColor(dark)
            backgroundTintList = ColorStateList.valueOf(orange)
            form.addView(this)
        }
        val nameField = field("Full name")
        val phoneField = field("Phone number (optional)").apply {
            inputType = android.text.InputType.TYPE_CLASS_PHONE
        }
        val emailField = field("Email (optional)").apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        val notesField = field("Notes (optional)").apply {
            setSingleLine(false)
            minLines = 2
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("Add New Client")
            .setView(form)
            .setPositiveButton("Save Client", null)
            .setNegativeButton("Cancel", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val clientName = nameField.text.toString().trim()
                if (clientName.isBlank() || clientName.length > 150) {
                    message("Enter a client name (up to 150 characters)")
                    return@setOnClickListener
                }
                val known = registeredClients() + bookings.map { it.client.trim() }
                if (known.any { it.equals(clientName, ignoreCase = true) }) {
                    message("Client already exists — open their profile instead")
                    return@setOnClickListener
                }
                val phone = phoneField.text.toString().trim()
                val email = emailField.text.toString().trim()
                val notes = notesField.text.toString().trim()
                if (phone.length > 50 || email.length > 254 || notes.length > 5000) {
                    message("Client details exceed allowed limits")
                    return@setOnClickListener
                }
                val records = JSONArray(prefs.getString("manual_clients", "[]") ?: "[]")
                records.put(JSONObject().put("name", clientName))
                val profile = JSONObject().put("phone", phone)
                    .put("email", email).put("notes", notes)
                val saved = prefs.edit()
                    .putString("manual_clients", records.toString())
                    .putString(clientProfileKey(clientName), profile.toString())
                    .commit()
                if (!saved) {
                    message("Unable to save client")
                    return@setOnClickListener
                }
                dialog.dismiss()
                showClients()
                message("Client registered locally")
                autoSyncClient(clientName, profile, label("", 12f, muted))
            }
        }
        dialog.show()
    }

    private fun showClients(query: String = "") {
        screen("Your clients", "Every relationship, beautifully organised.", "clients")
        val names = (bookings.map { it.client.trim() } + registeredClients()).filter { it.isNotBlank() }
            .distinctBy { it.lowercase(Locale.UK) }.sortedBy { it.lowercase(Locale.UK) }
        val directoryIntro = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
            background = rounded(paleOrange, 20)
        }
        directoryIntro.addView(label("BOUSTIO  •  CLIENT DIRECTORY", 11f, orange, true))
        directoryIntro.addView(label("Your clients, beautifully organised", 20f, dark, true),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(7) })
        directoryIntro.addView(label("Search, open profiles and review visit history in seconds.",
            13f, muted), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(5) })
        container.addView(directoryIntro, LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = dp(8); bottomMargin = dp(12)
        })
        val clientOverview = panel()
        clientOverview.addView(label("YOUR CLIENT DIRECTORY", 12f, orange, true))
        clientOverview.addView(label("${names.size} client${if (names.size == 1) "" else "s"}", 29f, dark, true))
        clientOverview.addView(label("Find people quickly and keep their history close.", 13f, muted))
        addPanel(clientOverview)
        button("+ Add New Client") { registerClientDialog() }
        val search = EditText(this).apply {
            hint = "Search clients by name"
            setSingleLine(true)
            setText(query)
            textSize = 16f
            setTextColor(dark)
            backgroundTintList = ColorStateList.valueOf(orange)
        }
        val searchCard = panel()
        searchCard.addView(label("SEARCH DIRECTORY", 12f, muted, true))
        searchCard.addView(search, LinearLayout.LayoutParams(-1, dp(54)))
        addPanel(searchCard)
        val results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        container.addView(results)
        fun updateResults(filter: String) {
            results.removeAllViews()
            val matching = names.filter { it.contains(filter.trim(), ignoreCase = true) }
            results.addView(label("SHOWING ${matching.size} OF ${names.size} CLIENTS", 12f, muted, true))
            if (names.isEmpty()) results.addView(label("No clients yet. Tap Add New Client to register one.", 14f, muted))
            else if (matching.isEmpty()) results.addView(label("No matching clients.", 14f, muted))
            matching.forEach { name ->
                val history = bookings.filter { it.client.trim().equals(name, ignoreCase = true) }
                val card = panel()
                val identity = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                }
                val initial = name.trim().take(1).uppercase(Locale.UK)
                val avatar = label(initial, 19f, orange, true).apply {
                    gravity = Gravity.CENTER
                    background = rounded(paleOrange, 18)
                }
                identity.addView(avatar, LinearLayout.LayoutParams(dp(44), dp(44)).apply {
                    marginEnd = dp(12)
                })
                val clientSummary = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                clientSummary.addView(label(name, 18f, dark, true))
                clientSummary.addView(label("${history.size} visit${if (history.size == 1) "" else "s"} recorded",
                    12f, muted))
                identity.addView(clientSummary, LinearLayout.LayoutParams(0, -2, 1f))
                card.addView(identity)
                card.addView(Button(this).apply {
                    text = "View Profile & History"
                    styleButton(this, false)
                    setOnClickListener { showClientProfile(name) }
                })
                results.addView(card, LinearLayout.LayoutParams(-1, -2).apply {
                    topMargin = dp(8)
                    bottomMargin = dp(6)
                })
            }
        }
        search.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updateResults(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
        updateResults(query)
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
        // Phase 11.42: persist local data first, then record unconfirmed upload
        // until the server acknowledges THIS exact snapshot. No automatic retry.
        val ownerAtSave = FirebaseAuth.getInstance().currentUser
        val editor = prefs.edit().putString("bookings", json)
        if (ownerAtSave != null && ownerAtSave.isEmailVerified) {
            editor.putString("bookingSyncPendingOwner", ownerAtSave.uid)
                .putString("bookingSyncPendingJson", json)
        }
        editor.apply()
        if (ownerAtSave != null && ownerAtSave.isEmailVerified) {
            CloudSyncManager().upload("bookings", json,
                prefs.getString("bookingSyncAcknowledgedOwner", null)
                    ?.takeIf { it == ownerAtSave.uid }
                    ?.let { prefs.getString("bookingSyncAcknowledgedJson", null) }) { result ->
                runOnUiThread {
                    if (FirebaseAuth.getInstance().currentUser?.uid != ownerAtSave.uid) return@runOnUiThread
                    if (result.isSuccess) {
                        // A newer local edit must not be marked synced by an older callback.
                        if (prefs.getString("bookingSyncPendingOwner", null) == ownerAtSave.uid &&
                            prefs.getString("bookingSyncPendingJson", null) == json &&
                            prefs.getString("bookings", null) == json) {
                            prefs.edit().remove("bookingSyncPendingOwner")
                                .remove("bookingSyncPendingJson")
                                .putString("bookingSyncAcknowledgedOwner", ownerAtSave.uid)
                                .putString("bookingSyncAcknowledgedJson", json).apply()
                        }
                    } else if (!isFinishing && !isDestroyed) {
                        message("Saved on phone; cloud sync not confirmed. Review Calendar.")
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

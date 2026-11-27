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

    private val purple = BoustioDesign.teal
    private val dark = Color.rgb(20, 49, 52)
    private val background = Color.rgb(244, 250, 249)

    private val prefs by lazy {
        getSharedPreferences("salonbook_data", MODE_PRIVATE)
    }

    private val bookings = mutableListOf<Booking>()
    private var selectedDate = today()
    private lateinit var container: LinearLayout
    private var activeTab = "Home"
    private var activeScreen = "Home"
    private var activePreview = ""
    private data class Route(val screen: String, val preview: String, val scroll: Int)
    private val backRoutes = java.util.ArrayDeque<Route>()
    private var renderedRoute: Route? = null
    private var restoringRoute = false

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (activeScreen == "Home") {
            AlertDialog.Builder(this).setTitle("Exit Boustio?")
                .setMessage("Your saved records will remain on this device.")
                .setPositiveButton("Exit") { _, _ -> finish() }
                .setNegativeButton("Stay", null).show()
            return
        }
        val previous = backRoutes.pollLast()
        restoringRoute = true
        try {
            if (previous != null) {
                restoreScreen(if (previous.screen == "ClientDetails") "Clients" else previous.screen, previous.preview)
                val scroll = screenScroll
                scroll.post { scroll.scrollTo(0, previous.scroll) }
            } else {
                restoreScreen(when (activeScreen) {
                    "Preview" -> "Hub"
                    "ClientDetails" -> "Clients"
                    else -> "Home"
                }, null)
            }
        } finally { restoringRoute = false }
    }
    private lateinit var screenScroll: ScrollView
    // Keep draft fields in memory only across configuration recreation; never persist personal data.
    private var activeDraftSnapshot: (() -> Bundle)? = null
    private var firstResume = true
    override fun onRetainNonConfigurationInstance(): Any? = activeDraftSnapshot?.invoke()

    private var refreshAfterChild = false
    private fun openChild(intent: Intent) {
        refreshAfterChild = true
        startActivity(intent)
    }
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // Never place client names or unfinished appointment fields in this navigation bundle.
        outState.putStringArrayList("navigation_history", ArrayList(backRoutes.map { if (it.screen == "ClientDetails") "Clients" else it.screen }))
        outState.putStringArrayList("navigation_history_previews", ArrayList(backRoutes.map { it.preview }))
        outState.putIntArray("navigation_history_scrolls", backRoutes.map { it.scroll }.toIntArray())
        outState.putString("navigation_screen", if (activeScreen == "ClientDetails") "Clients" else activeScreen)
        outState.putString("navigation_preview", activePreview)
        outState.putString("navigation_date", selectedDate)
        outState.putInt("navigation_scroll", if (::screenScroll.isInitialized) screenScroll.scrollY else 0)
    }
    private fun restoreScreen(route: String?, preview: String?) {
        when (route) {
            "Calendar" -> showCalendar()
            "Clients" -> showClients()
            "Settings" -> showBusinessSettings()
            "Appointments" -> showAppointments()
            "Hub" -> showBusinessHub()
            "Preview" -> showFeaturePreview(preview.orEmpty())
            else -> showDashboard()
        }
    }
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
        if (savedInstanceState != null && intent?.getStringExtra("boustio_tab") == null) {
            selectedDate = savedInstanceState.getString("navigation_date") ?: today()
            restoreScreen(savedInstanceState.getString("navigation_screen"), savedInstanceState.getString("navigation_preview"))
            val routes = savedInstanceState.getStringArrayList("navigation_history").orEmpty()
            val previews = savedInstanceState.getStringArrayList("navigation_history_previews").orEmpty()
            val scrolls = savedInstanceState.getIntArray("navigation_history_scrolls") ?: intArrayOf()
            routes.take(32).forEachIndexed { i, route ->
                if (route in setOf("Home", "Calendar", "Clients", "Settings", "Appointments", "Hub", "Preview")) {
                    backRoutes.addLast(Route(route, previews.getOrNull(i).orEmpty(), scrolls.getOrNull(i)?.coerceAtLeast(0) ?: 0))
                }
            }
            val offset = savedInstanceState.getInt("navigation_scroll")
            screenScroll.post { screenScroll.scrollTo(0, offset) }
        } else openRequestedTab()
        (lastNonConfigurationInstance as? Bundle)?.let { draft ->
            val id = draft.getString("existingId")
            val existing = id?.let { key -> bookings.firstOrNull { it.id == key } }
            if (id == null || existing != null) {
                window.decorView.post {
                    if (!isFinishing && !isDestroyed) bookingDialog(existing, selectedDate, draft)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        backRoutes.clear()
        renderedRoute = null
        openRequestedTab()
    }

    private fun openRequestedTab() {
        when (intent?.getStringExtra("boustio_tab")) {
            "Calendar" -> showCalendar()
            "Clients" -> showClients()
            "Settings" -> showBusinessSettings()
            else -> showDashboard()
        }
        intent?.removeExtra("boustio_tab")
    }

    override fun onResume() {
        super.onResume()
        if (firstResume) { firstResume = false; return }
        if (refreshAfterChild && ::container.isInitialized) {
            refreshAfterChild = false
            val offset = screenScroll.scrollY
            loadBookings()
            restoreScreen(if (activeScreen == "ClientDetails") "Clients" else activeScreen, activePreview)
            screenScroll.post { screenScroll.scrollTo(0, offset) }
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
        val next = Route(activeScreen, activePreview, 0)
        val previous = renderedRoute
        if (!restoringRoute && previous != null &&
            (previous.screen != next.screen || previous.preview != next.preview)) {
            if (next.screen == "Home") backRoutes.clear()
            else {
                if (backRoutes.size >= 32) backRoutes.removeFirst()
                backRoutes.addLast(previous.copy(scroll = if (::screenScroll.isInitialized) screenScroll.scrollY else 0))
            }
        }
        renderedRoute = next
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
        screenScroll = scroll
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
                Triple(R.drawable.nav_clients, "Clients", { openChild(Intent(this@MainActivity, ClientActivity::class.java)) }),
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
        val tile = BoustioDesign.tileFor(title)
        card.addView(FeatureIcon(this, tile).apply {
            background = rounded(tile.background, dp(14).toFloat())
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

    private fun businessProfile() {
        val key = "local_business_profile_v1"
        val original = prefs.getString(key, null)
        val saved = try { JSONObject(original ?: "{}") } catch (_: Exception) {
            message("Business profile could not be read. Existing data has not been changed.")
            return
        }
        val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(12), dp(20), dp(12)) }
        val fields = linkedMapOf("name" to "Business name", "description" to "About your business", "phone" to "Business phone", "email" to "Business email", "address" to "Business address")
        val inputs = fields.mapValues { (field, label) ->
            form.addView(dashboardLabel(label, 14f, true))
            EditText(this).apply {
                hint = label
                setText(saved.optString(field))
                filters = arrayOf(android.text.InputFilter.LengthFilter(if (field == "description") 1000 else 250))
                form.addView(this)
            }
        }
        form.addView(dashboardLabel("Saved on this TEST device only. Public publishing and registration are disabled.", 13f))
        val scroll = ScrollView(this).apply { addView(form) }
        val dialog = AlertDialog.Builder(this).setTitle("Business profile").setView(scroll)
            .setPositiveButton("Save", null).setNegativeButton("Cancel", null).create()
        dialog.show()
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val values = inputs.mapValues { it.value.text.toString().trim() }
            val error = BusinessProfileValidation.error(values)
            if (error != null) { message(error); return@setOnClickListener }
            if (prefs.getString(key, null) != original) { message("Profile changed. Reopen before saving."); return@setOnClickListener }
            val updated = JSONObject(saved.toString())
            values.forEach { (field, value) -> updated.put(field, value) }
            if (prefs.edit().putString(key, updated.toString()).commit()) { dialog.dismiss(); message("Business profile saved locally.") }
            else message("Profile save failed. Please try again.")
        }
    }

    private fun showBusinessSettings() {
        activeScreen = "Settings"
        activePreview = ""
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
        premiumCard("›", "Business profile", "Edit local business details") { businessProfile() }
        premiumCard("▦", "Business hub", "Organised business tools and previews") { showBusinessHub() }
        premiumCard("▤", "Services & Prices", "Manage your service catalogue") {
            openChild(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        premiumCard("♟", "Staff & Working Hours", "Manage your team and availability") {
            openChild(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        premiumCard("🔗", "My Boustio Booking Link", "Public booking profile • not connected") {
            message("Booking link is not connected in this test build.")
        }
        premiumCard("☏", "Customer Messages", "Private chat inbox • preview only") {
            message("Customer messaging is not enabled in this test build.")
        }
        sectionLabel("Account and tools")
        premiumCard("☁", "Cloud Account & Backup", "Cloud account, backup and restore") {
            openChild(Intent(this, CloudActivity::class.java))
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

    private fun homeAction(label: String, detail: String, action: () -> Unit) {
        premiumCard("›", label, detail, action)
    }

    private fun showDashboard() {
        activeScreen = "Home"
        activePreview = ""
        activeTab = "Home"
        screen("Good to see you")
        container.addView(TextView(this).apply {
            text = "Here's what's happening with your business today."
            textSize = 16f
            setTextColor(muted)
            setPadding(0, 0, 0, dp(18))
        })

        val summary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(Color.WHITE, dp(22).toFloat())
            elevation = dp(2).toFloat()
            setPadding(dp(18), dp(18), dp(18), dp(18))
        }
        summary.addView(TextView(this).apply {
            text = "YOUR BUSINESS • TODAY"
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(purple)
        })
        summary.addView(dashboardLabel("Your business at a glance", 21f, true))
        val stats = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            weightSum = 3f
        }
        listOf(
            dashboardStat("Today", bookings.count { it.date == today() }),
            dashboardStat("Upcoming", bookings.count { it.date >= today() }),
            dashboardStat("Total bookings", bookings.size)
        ).forEach { stat ->
            stats.addView(stat, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f).apply {
                marginEnd = dp(4)
            })
        }
        summary.addView(stats)
        container.addView(summary)

        sectionLabel("Quick actions")
        homeAction("New appointment", "Add a booking to your calendar") { bookingDialog() }
        homeAction("Appointment calendar", "View your diary and available dates") { showCalendar() }
        homeAction("Clients", "View your customer records") { showClients() }

        sectionLabel("Upcoming appointments")
        val upcoming = bookings.filter { it.date >= today() }
            .sortedWith(compareBy<Booking> { it.date }.thenBy { it.time })
            .take(3)
        if (upcoming.isEmpty()) {
            val empty = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = rounded(Color.WHITE, dp(20).toFloat())
                elevation = dp(2).toFloat()
                setPadding(dp(20), dp(20), dp(20), dp(20))
            }
            empty.addView(dashboardLabel("No upcoming appointments", 17f, true))
            empty.addView(TextView(this).apply {
                text = "Your next bookings will appear here."
                textSize = 14f
                setTextColor(muted)
            })
            container.addView(empty, LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = dp(14)
            })
        } else {
            upcoming.forEach { bookingCard(it) }
        }
        homeAction("View all appointments", "Browse and manage every booking") {
            showAppointments()
        }

        sectionLabel("Manage your business")
        homeAction("Business hub", "Explore all business tools and feature previews") { showBusinessHub() }
        homeAction("Business settings", "Services, staff, booking link and account") {
            showBusinessSettings()
        }
        container.addView(dashboardLabel("BOUSTIO • ISOLATED TEST PREVIEW", 10f),
            LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14) })
    }

    private var mediaPreviewResult: ((android.net.Uri, Int) -> Unit)? = null

    private fun showMessagingRehearsal() {
        text("Private messaging rehearsal — fictional conversation. Nothing is sent. Media previews are temporary.")
        val history = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        container.addView(history)
        val draft = EditText(this).apply {
            hint = "Write a fictional test message"
            filters = arrayOf(android.text.InputFilter.LengthFilter(1000))
        }
        container.addView(draft)
        val pause = android.widget.CheckBox(this).apply { text = "Pause messaging"; isChecked = true }
        container.addView(pause)
        var count = 0
        fun appendPreview(value: String) {
            if (pause.isChecked) { message("Messaging rehearsal is paused."); return }
            if (count >= 30) { message("Rehearsal limit reached. Clear the conversation."); return }
            history.addView(TextView(this).apply {
                text = value; textSize = 16f; setTextColor(dark)
                setPadding(dp(12), dp(10), dp(12), dp(10))
                background = rounded(mint, dp(12).toFloat())
            })
            count++
        }
        homeAction("Preview text message", "Add a fictional message to the rehearsal") {
            val value = draft.text.toString().trim()
            if (value.isBlank()) message("Enter a test message.")
            else if (!pause.isChecked && count < 30) { appendPreview("Business: " + value); draft.text.clear() }
            else appendPreview(value)
        }
        homeAction("Preview photograph", "Simulated attachment — no photo accessed") { appendPreview("Business: [Example photograph — not uploaded]") }
        homeAction("Preview voice note", "Simulated audio — no microphone accessed") { appendPreview("Business: [Example voice note — not recorded]") }
        fun chooseMedia(code: Int, intent: Intent) {
            if (pause.isChecked || count >= 30) { message("Unpause messaging or clear the conversation first."); return }
            mediaPreviewResult = { uri, kind ->
                if (activePreview == "messages" && history.isAttachedToWindow && !pause.isChecked && count < 30) {
                    try {
                        if (kind == 7187) {
                            val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                            contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, bounds) }
                            require(bounds.outWidth in 1..30000 && bounds.outHeight in 1..30000)
                            var sample = 1
                            while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 800) sample *= 2
                            val bitmap = contentResolver.openInputStream(uri)?.use {
                                android.graphics.BitmapFactory.decodeStream(it, null, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample })
                            } ?: error("Invalid photo")
                            history.addView(ImageView(this).apply {
                                setImageBitmap(bitmap); scaleType = ImageView.ScaleType.FIT_CENTER
                                contentDescription = "Local test photo"
                            }, LinearLayout.LayoutParams(-1, dp(180)))
                        } else {
                            history.addView(android.widget.Button(this).apply {
                                text = "Play local voice note"
                                setOnClickListener {
                                    try {
                                        startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "audio/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                                    } catch (_: Exception) { message("Audio playback app unavailable.") }
                                }
                            })
                        }
                        count++
                    } catch (_: Exception) { message("Unable to preview attachment.") }
                }
            }
            try { startActivityForResult(intent, code) }
            catch (_: Exception) { mediaPreviewResult = null; message("Media app unavailable.") }
        }
        homeAction("Attach local photograph", "Choose a test image") {
            chooseMedia(7187, Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "image/*" })
        }
        homeAction("Record voice note", "Open device audio recorder") {
            chooseMedia(7188, Intent(android.provider.MediaStore.Audio.Media.RECORD_SOUND_ACTION))
        }
        homeAction("Choose audio note", "Select existing test audio") {
            chooseMedia(7188, Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "audio/*" })
        }
        homeAction("Clear rehearsal", "Remove all fictional messages") {
            AlertDialog.Builder(this).setTitle("Clear conversation rehearsal?").setNegativeButton("Cancel", null)
                .setPositiveButton("Clear") { _, _ -> history.removeAllViews(); draft.text.clear(); count = 0; pause.isChecked = true }.show()
        }
        text("Actual customer conversations and delivery remain disabled. Recording and playback use device apps; those apps may retain recordings.")
        homeAction("Back to business hub", "Explore other business tools") { showBusinessHub() }
    }

    private fun previewRecurringAppointments() {
        val eligible = bookings.filter { it.serviceId.isNotBlank() && it.staffId.isNotBlank() }
        if (eligible.isEmpty()) { message("Create a TEST appointment with an assigned service and staff member first."); return }
        val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(8), dp(16), dp(8)) }
        val source = Spinner(this).apply { adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, eligible.map { it.client + " · " + it.date + " · " + it.time }) }
        val frequency = Spinner(this).apply { adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("Weekly", "Fortnightly", "Monthly")) }
        val count = EditText(this).apply { hint = "Future appointments (1–12)"; setText("4"); inputType = android.text.InputType.TYPE_CLASS_NUMBER }
        form.addView(source); form.addView(frequency); form.addView(count)
        val dialog = AlertDialog.Builder(this).setTitle("Recurring appointment preview").setView(form).setNegativeButton("Cancel", null).setPositiveButton("Check dates", null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val total = count.text.toString().toIntOrNull()
                val booking = eligible[source.selectedItemPosition]
                val anchor = runCatching { java.time.LocalDate.parse(booking.date) }.getOrNull()
                if (total == null || total !in 1..12 || anchor == null) { message("Choose 1–12 future appointments and a valid source date.") }
                else {
                    val results = RecurringDates.generate(anchor, frequency.selectedItemPosition, total).map { date ->
                        val future = runCatching { java.time.LocalDateTime.parse(date.toString() + "T" + booking.time).isAfter(java.time.LocalDateTime.now()) }.getOrDefault(false)
                        val check = AvailabilityEngine.checkAvailability(date.toString(), booking.time, booking.staffId, booking.serviceId,
                            prefs.getString("services", "[]") ?: "[]", prefs.getString("staff", "[]") ?: "[]", prefs.getString("bookings", "[]") ?: "[]")
                        date.toString() + " · " + booking.time + " — " + if (!future) "Past or invalid time" else if (check.available) "Available" else check.reason
                    }
                    dialog.dismiss()
                    AlertDialog.Builder(this).setTitle("Rebooking suggestions").setMessage(results.joinToString("\n") + "\n\nPreview only. No appointments are saved or reserved. Recheck before booking.").setPositiveButton("Close", null).show()
                }
            }
        }
        dialog.show()
    }

    private fun showWaitingList() {
        text("Local waiting list. Suggestions are not reservations. No customer notifications are sent.")
        homeAction("Recurring appointments and rebooking", "Check future dates using an existing appointment") { previewRecurringAppointments() }
        val key = "local_waiting_list_v1"
        val raw = prefs.getString(key, null)
        val entries = try { JSONArray(raw ?: "[]") } catch (_: Exception) {
            text("Waiting list could not be read. Existing data is protected."); return
        }
        val services = readRecords("services").filter { it.optString("id").isNotBlank() }
        val staff = readRecords("staff").filter { it.optString("id").isNotBlank() }
        fun save(updated: JSONArray) {
            if (prefs.getString(key, null) != raw) { message("List changed. Reopen and try again."); return }
            if (prefs.edit().putString(key, updated.toString()).commit()) showFeaturePreview("intelligence")
            else message("Unable to save waiting list.")
        }
        homeAction("Add waiting customer", "Choose a service and preferred date and time") {
            if (services.isEmpty()) { message("Add a service first."); return@homeAction }
            val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(8), dp(16), dp(8)) }
            val name = EditText(this).apply { hint = "Customer name"; filters = arrayOf(android.text.InputFilter.LengthFilter(100)) }
            val service = Spinner(this).apply { adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, services.map { it.optString("name") }) }
            val date = EditText(this).apply { hint = "Preferred date YYYY-MM-DD"; setText(today()) }
            val time = EditText(this).apply { hint = "Earliest time HH:MM"; setText("09:00") }
            form.addView(name); form.addView(service); form.addView(date); form.addView(time)
            val dialog = AlertDialog.Builder(this).setTitle("Waiting customer").setView(form).setNegativeButton("Cancel", null).setPositiveButton("Save", null).create()
            dialog.setOnShowListener {
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                    val day = runCatching { java.time.LocalDate.parse(date.text.toString().trim()) }.getOrNull()
                    val start = runCatching { java.time.LocalTime.parse(time.text.toString().trim()) }.getOrNull()
                    if (name.text.toString().isBlank() || day == null || day.isBefore(java.time.LocalDate.now()) || start == null || !time.text.toString().matches(Regex("[0-9]{2}:[0-9]{2}"))) {
                        message("Enter a name, current or future date and valid HH:MM time.")
                    } else {
                        val updated = JSONArray(entries.toString()).put(JSONObject().apply {
                            put("id", java.util.UUID.randomUUID().toString()); put("name", name.text.toString().trim())
                            put("serviceId", services[service.selectedItemPosition].optString("id"))
                            put("date", day.toString()); put("time", time.text.toString())
                        })
                        dialog.dismiss(); save(updated)
                    }
                }
            }
            dialog.show()
        }
        sectionLabel("Waiting customers")
        if (entries.length() == 0) text("No waiting customers yet.")
        for (i in 0 until entries.length()) {
            val entry = entries.optJSONObject(i) ?: continue
            val day = entry.optString("date")
            val serviceId = entry.optString("serviceId")
            sectionLabel(entry.optString("name"))
            text((services.firstOrNull { it.optString("id") == serviceId }?.optString("name") ?: "Service unavailable") + " · " + day + " from " + entry.optString("time"))
            homeAction("Find available slots", "Check current diary including newly freed slots") {
                val matches = staff.flatMap { person ->
                    AvailabilityEngine.availableSlots(day, person.optString("id"), serviceId,
                        prefs.getString("services", "[]") ?: "[]", prefs.getString("staff", "[]") ?: "[]",
                        prefs.getString("bookings", "[]") ?: "[]").filter { slot ->
                        slot.time >= entry.optString("time") && runCatching {
                            java.time.LocalDateTime.parse(slot.date + "T" + slot.time).isAfter(java.time.LocalDateTime.now())
                        }.getOrDefault(false)
                    }.map { slot -> slot.time + " · " + person.optString("name") }
                }.sorted().take(20)
                AlertDialog.Builder(this).setTitle("Available slot suggestions")
                    .setMessage(if (matches.isEmpty()) "No matching slots." else matches.joinToString("\n") + "\n\nRecheck availability before booking. No slot is reserved.")
                    .setPositiveButton("Close", null).show()
            }
            homeAction("Remove waiting entry", "Remove from this list only") {
                AlertDialog.Builder(this).setTitle("Remove waiting entry?").setNegativeButton("Cancel", null)
                    .setPositiveButton("Remove") { _, _ ->
                        val updated = JSONArray(entries.toString()); updated.remove(i); save(updated)
                    }.show()
            }
        }
        homeAction("Back to business hub", "Explore other business tools") { showBusinessHub() }
    }

    private fun showLoyaltyPlans() {
        text("Local marketing and loyalty plans only. No customers are enrolled, contacted or awarded rewards.")
        val key = "local_loyalty_plan_v1"
        val raw = prefs.getString(key, null)
        val plan = try { JSONObject(raw ?: "{}") } catch (_: Exception) {
            text("Plan could not be read. Existing data is protected."); return
        }
        sectionLabel("Loyalty programme")
        text("Reward: " + plan.optString("reward", "Not configured"))
        text("Visits required: " + plan.optString("visits", "Not configured"))
        sectionLabel("Promotional campaign draft")
        text(plan.optString("campaign", "No campaign drafted"))
        sectionLabel("Marketing consent")
        text("No recipients selected. Consent is unverified. Delivery is blocked.")
        homeAction("Edit loyalty and campaign plan", "Configure a reward and draft a promotion") {
            val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(8), dp(16), dp(8)) }
            fun field(label: String, value: String, limit: Int): EditText {
                form.addView(TextView(this).apply { text = label })
                return EditText(this).apply {
                    setText(value); filters = arrayOf(android.text.InputFilter.LengthFilter(limit)); form.addView(this)
                }
            }
            val reward = field("Reward description", plan.optString("reward"), 120)
            val visits = field("Visits required (1–100)", plan.optString("visits", "10"), 3)
            visits.inputType = android.text.InputType.TYPE_CLASS_NUMBER
            val campaign = field("Campaign draft", plan.optString("campaign"), 500)
            val dialog = AlertDialog.Builder(this).setTitle("Local loyalty plan").setView(form)
                .setNegativeButton("Cancel", null).setPositiveButton("Save plan", null).create()
            dialog.setOnShowListener {
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                    val name = reward.text.toString().trim()
                    val target = visits.text.toString().toIntOrNull()
                    if (name.isBlank() || target == null || target !in 1..100) {
                        message("Enter a reward and a visit target between 1 and 100.")
                    } else if (prefs.getString(key, null) != raw) {
                        message("Plan changed. Reopen and try again.")
                    } else {
                        val updated = JSONObject(plan.toString()).apply {
                            put("reward", name); put("visits", target); put("campaign", campaign.text.toString().trim())
                        }
                        if (prefs.edit().putString(key, updated.toString()).commit()) {
                            dialog.dismiss(); showFeaturePreview("marketing")
                        } else message("Unable to save plan.")
                    }
                }
            }
            dialog.show()
        }
        homeAction("Back to business hub", "Explore other business tools") { showBusinessHub() }
    }

    private fun showEmployeeDrafts() {
        text("Local employee access plans only. No accounts, invitations or actual permissions are activated.")
        val key = "local_employee_access_v1"
        val raw = prefs.getString(key, null)
        val plans = try { JSONObject(raw ?: "{}") } catch (_: Exception) {
            text("Access plans could not be read. Existing data is protected."); return
        }
        val staff = readRecords("staff").filter { it.optString("id").isNotBlank() }
        if (staff.isEmpty()) text("Add staff in Staff & Working Hours first.")
        for (person in staff) {
            val id = person.optString("id")
            val role = EmployeeAccessPlan.normalise(plans.optString(id))
            sectionLabel(person.optString("name"))
            text("Planned access: " + role)
            text(EmployeeAccessPlan.description(role))
            homeAction("Edit access plan", "Choose a proposed role") {
                val roles = EmployeeAccessPlan.roles
                var selected = roles.indexOf(role)
                AlertDialog.Builder(this).setTitle("Planned employee access")
                    .setSingleChoiceItems(roles.toTypedArray(), selected) { _, which -> selected = which }
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton("Save plan") { _, _ ->
                        if (prefs.getString(key, null) != raw) { message("Access plans changed. Reopen and try again.") }
                        else {
                            val updated = JSONObject(plans.toString())
                            updated.put(id, roles[selected])
                            if (prefs.edit().putString(key, updated.toString()).commit()) showFeaturePreview("team")
                            else message("Unable to save access plan.")
                        }
                    }.show()
            }
        }
        text("Owner-only: finances, subscriptions, security settings and permission administration. Employee plans do not restrict the current owner app.")
        homeAction("Manage local staff", "Open staff and working hours") {
            openChild(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        homeAction("Back to business hub", "Explore other business tools") { showBusinessHub() }
    }

    private var pendingPortfolioPhotoId: String? = null
    private fun portfolioImageFile(id: String): java.io.File? {
        if (!Regex("[a-fA-F0-9-]{36}").matches(id)) return null
        return java.io.File(java.io.File(noBackupFilesDir, "portfolio_images"), "$id.jpg")
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 7187 || requestCode == 7188) {
            val callback = mediaPreviewResult
            mediaPreviewResult = null
            if (resultCode == RESULT_OK) data?.data?.let { callback?.invoke(it, requestCode) }
            return
        }
        if (requestCode != 7184) return
        val id = pendingPortfolioPhotoId
        pendingPortfolioPhotoId = null
        if (resultCode != RESULT_OK || id == null) return
        val uri = data?.data ?: return
        val file = portfolioImageFile(id) ?: return
        if (readRecords("local_portfolio_drafts_v1").none { it.optString("id") == id }) return
        try {
            val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, bounds) }
            require(bounds.outWidth > 0 && bounds.outHeight > 0 && bounds.outWidth <= 30000 && bounds.outHeight <= 30000)
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1600) sample *= 2
            val bitmap = contentResolver.openInputStream(uri)?.use {
                android.graphics.BitmapFactory.decodeStream(it, null, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample })
            } ?: error("Invalid image")
            file.parentFile?.mkdirs()
            val atomic = android.util.AtomicFile(file)
            val output = atomic.startWrite()
            try {
                check(bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, output))
                atomic.finishWrite(output)
            } catch (e: Exception) { atomic.failWrite(output); throw e }
            finally { bitmap.recycle() }
            showFeaturePreview("portfolio")
        } catch (_: Exception) { message("Photo could not be saved. Existing photo is unchanged.") }
    }

    private fun showLocalPortfolio() {
        text("Local portfolio drafts — no public publishing or uploads.")
        val key = "local_portfolio_drafts_v1"
        val raw = prefs.getString(key, null)
        val entries = try { JSONArray(raw ?: "[]") } catch (_: Exception) {
            text("Portfolio data could not be read. Existing data is protected.")
            return
        }
        fun persist(updated: JSONArray) {
            if (prefs.getString(key, null) != raw) { message("Portfolio changed. Reopen before editing."); return }
            if (prefs.edit().putString(key, updated.toString()).commit()) showFeaturePreview("portfolio")
            else message("Unable to save portfolio.")
        }
        fun edit(index: Int?) {
            val previous = index?.let { entries.optJSONObject(it) }
            val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(12), dp(20), dp(12)) }
            val staff = readRecords("staff").filter { it.optString("id").isNotBlank() }
            val ids = listOf("") + staff.map { it.optString("id") }
            val names = listOf("Salon gallery") + staff.map { it.optString("name") }
            val owner = Spinner(this).apply {
                adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, names)
                setSelection(ids.indexOf(previous?.optString("staffId").orEmpty()).coerceAtLeast(0))
            }
            form.addView(owner)
            val title = EditText(this).apply { hint = "Portfolio title"; setText(previous?.optString("title").orEmpty()); filters = arrayOf(android.text.InputFilter.LengthFilter(100)) }
            val description = EditText(this).apply { hint = "Description"; setText(previous?.optString("description").orEmpty()); filters = arrayOf(android.text.InputFilter.LengthFilter(500)) }
            form.addView(title); form.addView(description)
            val dialog = AlertDialog.Builder(this).setTitle("Portfolio draft").setView(form).setPositiveButton("Save", null).setNegativeButton("Cancel", null).create()
            dialog.show()
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val name = title.text.toString().trim()
                if (name.isBlank()) { message("Enter a portfolio title."); return@setOnClickListener }
                val updated = JSONArray(entries.toString())
                val item = JSONObject(previous?.toString() ?: "{}")
                item.put("id", previous?.optString("id") ?: UUID.randomUUID().toString())
                item.put("title", name); item.put("description", description.text.toString().trim())
                item.put("staffId", ids[owner.selectedItemPosition.coerceAtLeast(0)])
                if (index == null) updated.put(item) else updated.put(index, item)
                dialog.dismiss(); persist(updated)
            }
        }
        homeAction("Add portfolio draft", "Create a salon or staff portfolio entry") { edit(null) }
        if (entries.length() == 0) text("No portfolio drafts yet.")
        for (i in 0 until entries.length()) {
            val item = entries.optJSONObject(i) ?: continue
            val staffId = item.optString("staffId")
            val owner = if (staffId.isBlank()) "Salon gallery" else readRecords("staff").firstOrNull { it.optString("id") == staffId }?.optString("name") ?: "Staff unavailable"
            sectionLabel(owner)
            text(item.optString("title"))
            text(item.optString("description"))
            val imageId = item.optString("id")
            val photo = portfolioImageFile(imageId)
            if (photo != null && photo.exists()) {
                val bitmap = android.graphics.BitmapFactory.decodeFile(photo.path)
                if (bitmap != null) container.addView(ImageView(this).apply {
                    setImageBitmap(bitmap)
                    scaleType = ImageView.ScaleType.FIT_CENTER
                    contentDescription = "Portfolio photo: " + item.optString("title")
                }, LinearLayout.LayoutParams(-1, dp(180)))
                homeAction("Remove photo", "Remove the local image") {
                    AlertDialog.Builder(this).setTitle("Remove photo?").setNegativeButton("Cancel", null).setPositiveButton("Remove") { _, _ ->
                        if (photo.delete()) showFeaturePreview("portfolio") else message("Unable to remove photo.")
                    }.show()
                }
            }
            homeAction("Choose photo", "Select a photo from your device") {
                pendingPortfolioPhotoId = imageId
                try { startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }, 7184) } catch (_: Exception) { pendingPortfolioPhotoId = null; message("Photo picker unavailable.") }
            }
            homeAction("Edit draft", "Change portfolio details") { edit(i) }
            homeAction("Delete draft", "Remove this local entry") {
                AlertDialog.Builder(this).setTitle("Delete portfolio draft?").setNegativeButton("Cancel", null).setPositiveButton("Delete") { _, _ ->
                    val updated = JSONArray(entries.toString()); updated.remove(i); persist(updated)
                    if (readRecords(key).none { it.optString("id") == imageId }) photo?.delete()
                }.show()
            }
        }
        text("Photos are stored privately on this device. Gallery publishing remains disabled.")
        homeAction("Back to business hub", "Explore other business tools") { showBusinessHub() }
    }

    private fun showBusinessHub() {
        activeTab = "Settings"
        activeScreen = "Hub"
        activePreview = ""
        screen("Business hub")
        text("Manage your local business tools. Online services remain isolated previews.")
        sectionLabel("Available on this device")
        premiumCard("›", "Business profile", "Edit local business details") { businessProfile() }
        premiumCard("▤", "Services & Prices", "Manage your local service catalogue") {
            openChild(Intent(this, ManagementActivity::class.java).putExtra("staff", false))
        }
        premiumCard("♟", "Staff & Working Hours", "Manage local staff and availability") {
            openChild(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
        }
        premiumCard("▣", "All Appointments", "Manage your local diary") { showAppointments() }
        premiumCard("›", "Appointment calendar", "View local appointment availability") { showCalendar() }
        BusinessHubPreview.categories.forEach { category ->
            sectionLabel(category.title)
            category.features.forEach { feature ->
                premiumCard("›", feature.title, if (feature.id == "customers") "Open local customer records" else feature.description) {
                    if (feature.id == "customers") showClients() else showFeaturePreview(feature.id)
                }
            }
        }
        homeAction("Back to settings", "Return to business settings") { showBusinessSettings() }
    }

    private fun showFeaturePreview(id: String) {
        val feature = BusinessHubPreview.find(id)
        if (feature == null) { showBusinessHub(); return }
        activeTab = "Settings"
        activeScreen = "Preview"
        activePreview = feature.id
        screen(feature.title)
        if (id == "portfolio") { showLocalPortfolio(); return }
        if (id == "team") { showEmployeeDrafts(); return }
        if (id == "messages") { showMessagingRehearsal(); return }
        if (id == "marketing") { showLoyaltyPlans(); return }
        if (id == "intelligence") { showWaitingList(); return }
        text("ISOLATED PREVIEW — no live actions")
        text(feature.description)
        text("Example only. No customer records, payments, messages or bookings are changed.")
        when (id) {
            "team" -> {
                sectionLabel("Local team overview")
                text("${readRecords("staff").size} staff records on this device")
                text("Owner, manager and employee permissions are preview only. No invitations or access changes.")
                homeAction("Manage local staff", "Open existing staff and working hours") {
                    openChild(Intent(this, ManagementActivity::class.java).putExtra("staff", true))
                }
            }
            "messages" -> {
                sectionLabel("Communication previews")
                text("Chat, appointment reminders and cancellation notices")
                text("Example reminder: Your appointment is tomorrow.")
                text("Example cancellation: Your appointment has been cancelled. Please contact the business to rearrange.")
                text("Delivery disabled — no email, WhatsApp or push messages are sent.")
            }
            "reports" -> {
                sectionLabel("Local diary overview")
                text("${bookings.size} saved appointments")
                text("${bookings.map { it.client }.distinct().size} distinct client names")
                text("Scheduled appointment values only — not verified revenue or employee takings.")
                val period = Spinner(this)
                period.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, listOf("Today", "This week", "This month", "This year"))
                container.addView(period)
                val report = TextView(this).apply { textSize = 16f; setTextColor(dark); setPadding(0, dp(12), 0, dp(12)) }
                container.addView(report)
                period.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                        val result = DiaryReporting.summarise(bookings.map { DiaryReporting.Entry(it.date, it.price, it.staffId) }, today(), position)
                        report.text = "Appointments: ${result.count}\nScheduled value: £${result.total.setScale(2).toPlainString()}\nMissing or invalid prices: ${result.unknown}\nAppointments without staff assignment: ${result.unassigned}"
                        val staffNames = readRecords("staff").associate { it.optString("id") to it.optString("name") }
                        val rows = DiaryReporting.byStaff(bookings.map { DiaryReporting.Entry(it.date, it.price, it.staffId) }, today(), position)
                        val breakdown = rows.joinToString("\n") { row ->
                            val name = if (row.staffId.isBlank()) "Unassigned" else staffNames[row.staffId]?.takeIf { it.isNotBlank() } ?: "Unavailable staff"
                            "$name: ${row.summary.count} appointments · £${row.summary.total.setScale(2).toPlainString()} scheduled · ${row.summary.unknown} unknown prices"
                        }
                        report.append("\n\nEmployee scheduled values\n" + breakdown.ifBlank { "No appointments in this period." })
                        report.append("\n\nActual takings\nCash: not recorded\nCard: not recorded\nRefunds: not recorded\nTips: not recorded\nNo payment ledger is connected. These amounts are unknown, not zero.")

                    }
                }
                homeAction("View appointments", "Inspect the existing local diary") { showAppointments() }
            }
        }
        homeAction("Back to business hub", "Explore other business tools") { showBusinessHub() }
    }

    private fun showCalendar() {
        activeScreen = "Calendar"
        activePreview = ""
        activeTab = "Calendar"
        screen("Appointment calendar")
        container.addView(TextView(this).apply {
            text = "Your appointments, beautifully organised."
            textSize = 16f
            setTextColor(muted)
            setPadding(0, 0, 0, dp(18))
        })

        val datePanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(Color.WHITE, dp(22).toFloat())
            elevation = dp(2).toFloat()
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }
        datePanel.addView(TextView(this).apply {
            text = "SELECTED DATE"
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(purple)
        })
        datePanel.addView(dashboardLabel(FriendlyDate.format(selectedDate, "EEEE").uppercase(Locale.UK), 15f, true).apply { setTextColor(purple) })
        datePanel.addView(dashboardLabel(FriendlyDate.format(selectedDate, "dd MMM yyyy"), 30f, true))
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            isBaselineAligned = false
        }
        fun dateAction(label: String, description: String, action: () -> Unit) {
            val selected = label == "Today" && selectedDate == today()
            val tile = android.widget.FrameLayout(this).apply {
                background = rounded(if (selected) Color.rgb(0, 105, 100) else mint, dp(12).toFloat())
                contentDescription = description
                isClickable = true
                isFocusable = true
                accessibilityDelegate = object : View.AccessibilityDelegate() {
                    override fun onInitializeAccessibilityNodeInfo(host: View, info: android.view.accessibility.AccessibilityNodeInfo) {
                        super.onInitializeAccessibilityNodeInfo(host, info)
                        info.className = "android.widget.Button"
                        info.isSelected = selected
                    }
                }
                setOnClickListener { action() }
            }
            if (description == "Choose another date") {
                tile.addView(ImageView(this).apply {
                    setImageResource(R.drawable.nav_calendar)
                    setColorFilter(purple)
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, android.widget.FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            } else {
                tile.addView(TextView(this).apply {
                    text = label
                    textSize = if (label == "‹" || label == "›") 26f else 14f
                    setTextColor(if (selected) Color.WHITE else purple)
                    gravity = Gravity.CENTER
                    includeFontPadding = false
                    typeface = Typeface.DEFAULT_BOLD
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, android.widget.FrameLayout.LayoutParams(-1, -1))
            }
            controls.addView(tile, LinearLayout.LayoutParams(0, dp(52), 1f).apply { marginEnd = dp(4) })
        }
        dateAction("‹", "Previous day") { selectedDate = FriendlyDate.shift(selectedDate, -1); showCalendar() }
        dateAction("Today", "Go to today") { selectedDate = today(); showCalendar() }
        dateAction("▦", "Choose another date") { pickDate(selectedDate) { selectedDate = it; showCalendar() } }
        dateAction("›", "Next day") { selectedDate = FriendlyDate.shift(selectedDate, 1); showCalendar() }
        datePanel.addView(controls, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
        container.addView(datePanel)

        sectionLabel("Your diary")
        val daily = bookings.filter { it.date == selectedDate }.sortedBy { it.time }
        val diary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(mint, dp(18).toFloat())
            setPadding(dp(16), dp(14), dp(16), dp(14))
        }
        diary.addView(dashboardLabel(
            if (daily.size == 1) "1 appointment" else "${daily.size} appointments",
            18f, true
        ))
        diary.addView(TextView(this).apply {
            text = "For ${FriendlyDate.format(selectedDate)}"
            textSize = 13f
            setTextColor(muted)
        })
        container.addView(diary)

        sectionLabel("Appointments")
        if (daily.isEmpty()) {
            val empty = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = rounded(Color.WHITE, dp(20).toFloat())
                elevation = dp(2).toFloat()
                setPadding(dp(20), dp(22), dp(20), dp(22))
            }
            empty.addView(dashboardLabel("No appointments on this date", 17f, true))
            empty.addView(TextView(this).apply {
                text = "Choose another date or create a new appointment."
                textSize = 14f
                setTextColor(muted)
            })
            container.addView(empty)
        } else {
            daily.forEach { bookingCard(it) }
        }

        sectionLabel("Quick actions")
        homeAction("New appointment", "Book a client for the selected date") {
            bookingDialog(defaultDate = selectedDate)
        }
        homeAction("All appointments", "Browse and manage your full diary") {
            showAppointments()
        }
    }

    private fun showAppointments() {
        activeScreen = "Appointments"
        activePreview = ""
        screen("All Appointments")
        text("Your complete diary, organised by date and time.")
        sectionLabel("${bookings.size} saved appointments")

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

        button("Back") {
            onBackPressed()
        }
    }

    private fun bookingCard(booking: Booking) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(18))
            background = rounded(Color.WHITE, dp(20).toFloat())
            elevation = dp(2).toFloat()
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
                    FriendlyDate.format(booking.date)
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

        card.addView(dashboardLabel("SAVED APPOINTMENT", 12f, true).apply { setTextColor(purple) })
        card.addView(TextView(this).apply {
            text = details
            textSize = 16f
            setTextColor(dark)
            setPadding(0, 0, 0, 12)
        })

        card.addView(Button(this).apply {
            text = "Manage appointment  ›"
            isAllCaps = false
            setTextColor(purple)
            background = rounded(mint, dp(12).toFloat())

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
                bottomMargin = dp(14)
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
                    "appointment on ${FriendlyDate.format(booking.date)} " +
                    "at ${booking.time}?"
            )
            .setPositiveButton(
                "Cancel Appointment"
            ) { _, _ ->

                bookings.removeAll {
                    it.id == booking.id
                }

                saveBookings()
                restoreScreen(if (activeScreen == "ClientDetails") "Clients" else activeScreen, activePreview)

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
        defaultDate: String = selectedDate,
        recovered: Bundle? = null
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
            recovered?.getString("client") ?: existing?.client ?: ""
        )

        val knownClients = (bookings.map { it.client } + readRecords("client_records_v1").map { it.optString("name") })
            .map { it.trim() }.filter { it.isNotEmpty() }.distinct().sortedWith(String.CASE_INSENSITIVE_ORDER)
        form.addView(Button(this).apply {
            text = "Choose existing client"
            isAllCaps = false
            isEnabled = knownClients.isNotEmpty()
            setOnClickListener {
                AlertDialog.Builder(this@MainActivity).setTitle("Existing clients")
                    .setItems(knownClients.toTypedArray()) { _, index -> client.setText(knownClients[index]) }.show()
            }
        })
        val notes = field(
            "Notes (optional)",
            recovered?.getString("notes") ?: existing?.notes ?: ""
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
                    (recovered?.getString("serviceId") ?: existing?.serviceId)
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
                    (recovered?.getString("staffId") ?: existing?.staffId)
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
            recovered?.getString("date") ?: existing?.date ?: defaultDate

        var time =
            recovered?.getString("time") ?: existing?.time ?: "09:00"

        var refreshChoices: () -> Unit = {}
        val dateButton = Button(this).apply {
            text = "Date: $date"
            isAllCaps = false
        }

        dateButton.setOnClickListener {
            pickDate(date) {
                date = it
                dateButton.text = "Date: $date"
                refreshChoices()
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
                    refreshChoices()
                },
                parts[0].toInt(),
                parts[1].toInt(),
                true
            ).show()
        }

        form.addView(timeButton)

        val summary = TextView(this).apply { textSize = 16f; setTextColor(muted) }
        form.addView(summary)
        form.addView(TextView(this).apply { text = "Available start times"; textSize = 16f })
        val slots = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        form.addView(slots)
        refreshChoices = refresh@{
            val service = services.getOrNull(serviceSpinner.selectedItemPosition) ?: return@refresh
            val member = staff.getOrNull(staffSpinner.selectedItemPosition) ?: return@refresh
            summary.text = "${service.optString("name")} · £${service.optString("price")} · ${service.optInt("duration")} min\n${member.optString("name")} · ${date} · $time"
            slots.removeAllViews()
            val options = (0 until 1440 step 15).map { formatTime(it) }.filter { candidate ->
                AvailabilityEngine.checkAvailability(date, candidate, member.optString("id"), service.optString("id"),
                    prefs.getString("services", "[]") ?: "[]", prefs.getString("staff", "[]") ?: "[]",
                    prefs.getString("bookings", "[]") ?: "[]", existing?.id.orEmpty()).available
            }
            if (options.isEmpty()) slots.addView(TextView(this).apply { text = "No available times" })
            options.chunked(3).forEach { group ->
                val row = LinearLayout(this)
                group.forEach { candidate ->
                    row.addView(Button(this).apply {
                        text = candidate
                        isAllCaps = false
                        setTextColor(if (candidate == time) Color.WHITE else purple)
                        background = rounded(if (candidate == time) purple else mint, 12f)
                        setOnClickListener { time = candidate; timeButton.text = "Time: $time"; refreshChoices() }
                    }, LinearLayout.LayoutParams(0, dp(48), 1f))
                }
                slots.addView(row)
            }
        }
        val listener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) {}
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) { refreshChoices() }
        }
        serviceSpinner.onItemSelectedListener = listener
        staffSpinner.onItemSelectedListener = listener
        refreshChoices()
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

        dialog.setOnDismissListener { activeDraftSnapshot = null }
        dialog.setOnShowListener {
            activeDraftSnapshot = {
                Bundle().apply {
                    putString("existingId", existing?.id)
                    putString("client", client.text.toString())
                    putString("notes", notes.text.toString())
                    putString("serviceId", services.getOrNull(serviceSpinner.selectedItemPosition)?.optString("id"))
                    putString("staffId", staff.getOrNull(staffSpinner.selectedItemPosition)?.optString("id"))
                    putString("date", date)
                    putString("time", time)
                }
            }
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

                val availability = AvailabilityEngine.checkAvailability(
                    date = date, time = time, staffId = staffId,
                    serviceId = service.optString("id"),
                    servicesJson = prefs.getString("services", "[]") ?: "[]",
                    staffJson = prefs.getString("staff", "[]") ?: "[]",
                    bookingsJson = prefs.getString("bookings", "[]") ?: "[]",
                    excludeBookingId = existing?.id.orEmpty()
                )
                if (!availability.available) {
                    message(availability.reason)
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

        dialog.setCancelable(false)
        dialog.setCanceledOnTouchOutside(false)
        dialog.setOnKeyListener { _, keyCode, event ->
            if (keyCode == android.view.KeyEvent.KEYCODE_BACK) {
                if (event.action == android.view.KeyEvent.ACTION_UP) {
                    AlertDialog.Builder(this).setTitle("Discard unsaved changes?")
                        .setPositiveButton("Discard") { _, _ -> dialog.dismiss() }
                        .setNegativeButton("Keep editing", null).show()
                }
                true
            } else false
        }
        dialog.show()
        dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener {
            AlertDialog.Builder(this).setTitle("Discard unsaved changes?")
                .setPositiveButton("Discard") { _, _ -> dialog.dismiss() }
                .setNegativeButton("Keep editing", null).show()
        }
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
        activeScreen = "Clients"
        activePreview = ""
        activeTab = "Clients"
        screen("Your clients")
        container.addView(TextView(this).apply {
            text = "Manage client profiles and appointment history."
            textSize = 16f
            setTextColor(muted)
        })
        sectionLabel("Client management")
        premiumCard("+", "Open client directory", "Add, edit and search saved client profiles") {
            openChild(Intent(this, ClientActivity::class.java))
        }
        sectionLabel("Appointment clients")
        val names = bookings.map { it.client.trim() }.filter { it.isNotEmpty() }
            .distinct().sortedWith(String.CASE_INSENSITIVE_ORDER)
        if (names.isEmpty()) {
            premiumCard("♙", "No appointment clients yet",
                "Create a booking or add a client profile") {
                openChild(Intent(this, ClientActivity::class.java))
            }
        } else {
            names.forEach { name ->
                val count = bookings.count { it.client.trim() == name }
                premiumCard("♙", name, "$count appointment(s) • view history") {
                    showClientDetails(name)
                }
            }
        }
    }

    private fun showClientDetails(clientName: String) {
        activeScreen = "ClientDetails"
        activePreview = ""
        activeTab = "Clients"
        screen(clientName)
        sectionLabel("Appointment history")
        val history = bookings.filter { it.client.trim() == clientName }
            .sortedWith(compareByDescending<Booking> { it.date }.thenByDescending { it.time })
        if (history.isEmpty()) text("No appointments yet")
        history.forEach { bookingCard(it) }
        homeAction("Back to clients", "Return to client directory") { showClients() }
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

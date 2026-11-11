package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.Locale
import java.util.UUID

class ManagementActivity : Activity() {

    private val orange = Color.rgb(17, 107, 104) // Option C signature teal
    private val dark = Color.rgb(23, 51, 50)
    private val muted = Color.rgb(101, 113, 111)
    private val backgroundColor = Color.rgb(247, 248, 246)
    private val panelColor = Color.rgb(231, 243, 239)
    private val white = Color.WHITE

    private val prefs by lazy {
        getSharedPreferences("salonbook_data", MODE_PRIVATE)
    }

    private val staffMode by lazy {
        intent.getBooleanExtra("staff", false)
    }

    private val storageKey: String
        get() = if (staffMode) "staff" else "services"

    private val records = mutableListOf<JSONObject>()
    private lateinit var layout: LinearLayout

    private val days = listOf(
        "monday", "tuesday", "wednesday",
        "thursday", "friday", "saturday", "sunday"
    )

    private val shortDays = listOf(
        "mon", "tue", "wed", "thu",
        "fri", "sat", "sun"
    )

    private data class DayFields(
        val enabled: CheckBox,
        val opening: EditText,
        val closing: EditText
    )

    private data class PeriodFields(
        val container: LinearLayout,
        val day: Spinner?,
        val date: EditText?,
        val start: EditText,
        val end: EditText,
        val note: EditText
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = backgroundColor
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        window.navigationBarColor = backgroundColor
        load()
        render()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun rounded(
        colour: Int,
        radius: Int = 20,
        border: Int? = null
    ): GradientDrawable {
        return GradientDrawable().apply {
            setColor(colour)
            cornerRadius = dp(radius).toFloat()
            if (border != null) {
                setStroke(dp(1), border)
            }
        }
    }

    private fun styleInput(input: EditText) {
        input.setTextColor(dark)
        input.setHintTextColor(muted)
        input.backgroundTintList =
            ColorStateList.valueOf(orange)
    }

    private fun styleCheck(check: CheckBox) {
        check.setTextColor(dark)
        check.buttonTintList =
            ColorStateList.valueOf(orange)
    }

    private fun styleButton(button: Button) {
        button.isAllCaps = false
        button.textSize = 15f
        button.minHeight = dp(48)
        button.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        button.setTextColor(white)
        button.backgroundTintList =
            ColorStateList.valueOf(orange)
    }

    private fun makeText(
        value: String,
        size: Float = 16f,
        colour: Int = dark,
        bold: Boolean = false
    ): TextView {
        return TextView(this).apply {
            text = value
            textSize = size
            setTextColor(colour)
            if (bold) {
                typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            }
        }
    }

    private fun load() {
        records.clear()
        try {
            val array = JSONArray(
                prefs.getString(storageKey, "[]") ?: "[]"
            )
            for (i in 0 until array.length()) {
                records.add(array.getJSONObject(i))
            }
        } catch (_: Exception) {
            Toast.makeText(
                this,
                "Unable to load saved data",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun loadAvailableServices(): List<JSONObject> {
        val result = mutableListOf<JSONObject>()
        try {
            val array = JSONArray(
                prefs.getString("services", "[]") ?: "[]"
            )
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                if (
                    item.optString("id").isNotBlank() &&
                    item.optString("name").isNotBlank()
                ) {
                    result.add(item)
                }
            }
        } catch (_: Exception) {
            Toast.makeText(
                this,
                "Unable to load services",
                Toast.LENGTH_LONG
            ).show()
        }
        return result
    }

    private fun assignedIds(item: JSONObject?): Set<String> {
        val result = mutableSetOf<String>()
        val array = item?.optJSONArray("serviceIds")
            ?: return result

        for (i in 0 until array.length()) {
            val id = array.optString(i)
            if (id.isNotBlank()) result.add(id)
        }
        return result
    }

    private fun parseMinutes(value: String): Int? {
        val match = Regex(
            """^([01]\d|2[0-3]):([0-5]\d)$"""
        ).matchEntire(value.trim()) ?: return null

        return match.groupValues[1].toInt() * 60 +
            match.groupValues[2].toInt()
    }

    private fun validPeriod(
        start: String,
        end: String
    ): Boolean {
        val a = parseMinutes(start) ?: return false
        val b = parseMinutes(end) ?: return false
        return a < b
    }

    private fun validDate(value: String): Boolean {
        if (!Regex("""^\d{4}-\d{2}-\d{2}$""")
                .matches(value)) return false

        return try {
            LocalDate.parse(value)
            true
        } catch (_: DateTimeParseException) {
            false
        }
    }

    private fun legacySchedule(hours: String): JSONObject? {
        val input = hours.trim().lowercase(Locale.ROOT)

        val match = Regex(
            """^(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$"""
        ).matchEntire(input) ?: return null

        val first = shortDays.indexOf(match.groupValues[1])

        val last = if (match.groupValues[2].isBlank()) {
            first
        } else {
            shortDays.indexOf(match.groupValues[2])
        }

        val open = match.groupValues[3]
        val close = match.groupValues[4]

        if (
            first < 0 || last < first ||
            !validPeriod(open, close)
        ) return null

        val schedule = JSONObject()

        for (i in first..last) {
            schedule.put(
                days[i],
                JSONObject().apply {
                    put("open", open)
                    put("close", close)
                }
            )
        }

        return schedule
    }

    private fun existingSchedule(item: JSONObject?): JSONObject {
        if (item == null) return JSONObject()

        return item.optJSONObject("weeklySchedule")
            ?: legacySchedule(item.optString("hours"))
            ?: JSONObject()
    }

    private fun scheduleSummary(item: JSONObject): String {
        val schedule = item.optJSONObject("weeklySchedule")
            ?: return item.optString("hours", "Not set")

        val active = mutableListOf<String>()

        days.forEach { day ->
            val period = schedule.optJSONObject(day)
            if (period != null) {
                active.add(
                    "${day.take(3).replaceFirstChar { it.uppercase() }} " +
                        "${period.optString("open")}-" +
                        period.optString("close")
                )
            }
        }

        return if (active.isEmpty()) {
            "No working days"
        } else {
            active.joinToString(", ")
        }
    }

    private fun save() {
        val array = JSONArray()
        records.forEach { array.put(it) }
        val json = array.toString()

        prefs.edit()
            .putString(storageKey, json)
            .apply()

        if (
            FirebaseAuth.getInstance()
                .currentUser?.isEmailVerified == true
        ) {
            CloudSyncManager().upload(
                storageKey, json
            ) { result ->
                result.exceptionOrNull()?.let { error ->
                    runOnUiThread {
                        if (!isFinishing && !isDestroyed) {
                            Toast.makeText(
                                this,
                                "Cloud sync failed: " +
                                    (error.localizedMessage
                                        ?: "Unknown error"),
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                }
            }
        }
    }

    private fun render() {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(backgroundColor)
            isFillViewport = true
        }

        layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(
                dp(20), dp(24), dp(20), dp(30)
            )
        }

        scroll.addView(layout)
        setContentView(scroll)

        val title = if (staffMode) {
            "Your Team"
        } else {
            "Services & Prices"
        }

        layout.addView(
            makeText(
                "BOUSTIO",
                14f,
                orange,
                true
            )
        )

        layout.addView(
            makeText(
                title,
                29f,
                dark,
                true
            ),
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(8)
            }
        )

        layout.addView(
            makeText(
                if (staffMode) {
                    "Manage your team, working hours and availability."
                } else {
                    "Keep your treatments, prices and durations organised."
                },
                15f,
                muted
            ),
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(8)
                bottomMargin = dp(20)
            }
        )

        val summary = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(
                dp(20), dp(18), dp(20), dp(18)
            )
            background = rounded(orange)
        }

        summary.addView(
            makeText(
                if (staffMode) "TEAM MEMBERS" else "ACTIVE SERVICES",
                13f,
                white,
                true
            )
        )

        summary.addView(
            makeText(
                records.size.toString(),
                36f,
                white,
                true
            )
        )

        summary.addView(
            makeText(
                "${records.count {
                    it.optBoolean("publicVisible", false)
                }} visible on your public catalogue",
                13f,
                white
            )
        )

        layout.addView(
            summary,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(20)
            }
        )

        addButton(
            if (staffMode) "+ Add Staff Member"
            else "+ Add New Service"
        ) {
            edit(null)
        }

        sectionHeading(
            if (staffMode) "TEAM DIRECTORY"
            else "SERVICE CATALOGUE"
        )

        if (records.isEmpty()) {
            val empty = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(
                    dp(20), dp(30), dp(20), dp(30)
                )
                background = rounded(white)
            }

            empty.addView(
                makeText(
                    if (staffMode) "No team members yet"
                    else "No services yet",
                    19f,
                    dark,
                    true
                )
            )

            empty.addView(
                makeText(
                    "Tap the orange button above to get started.",
                    14f,
                    muted
                )
            )

            layout.addView(empty)
        }

        val serviceNames = if (staffMode) {
            loadAvailableServices().associate {
                it.optString("id") to it.optString("name")
            }
        } else {
            emptyMap()
        }

        records.forEach { item ->
            recordCard(item, serviceNames)
        }

        addButton("Back to Dashboard") {
            finish()
        }

        layout.addView(
            makeText(
                "BOUSTIO  •  BUSINESS MANAGEMENT",
                12f,
                muted
            ),
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(20)
            }
        )
    }

    private fun sectionHeading(label: String) {
        layout.addView(
            makeText(
                label,
                12f,
                muted,
                true
            ),
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(16)
                bottomMargin = dp(14)
            }
        )
    }

    private fun recordCard(
        item: JSONObject,
        serviceNames: Map<String, String>
    ) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(
                dp(18), dp(18), dp(18), dp(18)
            )
            background = rounded(white)
            elevation = dp(2).toFloat()
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val title = makeText(
            item.optString("name"),
            19f,
            dark,
            true
        )

        header.addView(
            title,
            LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1f
            )
        )

        val visible = item.optBoolean(
            "publicVisible", false
        )

        val status = makeText(
            if (visible) "PUBLIC" else "PRIVATE",
            11f,
            if (visible) orange else muted,
            true
        ).apply {
            setPadding(
                dp(10), dp(7), dp(10), dp(7)
            )
            background = rounded(
                if (visible) {
                    Color.rgb(255, 239, 228)
                } else {
                    panelColor
                },
                12
            )
        }

        header.addView(status)
        card.addView(header)

        if (staffMode) {
            card.addView(
                makeText(
                    item.optString("role"),
                    15f,
                    muted
                )
            )

            val assigned = assignedIds(item)
            val names = assigned.mapNotNull {
                serviceNames[it]
            }

            val serviceSummary = when {
                assigned.isEmpty() -> "None assigned"
                names.isEmpty() ->
                    "Assigned services unavailable"
                else -> names.joinToString(", ")
            }

            val breaks = item.optJSONArray("weeklyBreaks")
                ?.length() ?: 0

            val timeOff = item.optJSONArray("timeOff")
                ?.length() ?: 0

            card.addView(
                makeText(
                    "Working hours\n${scheduleSummary(item)}",
                    14f,
                    dark
                ),
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dp(14)
                }
            )

            card.addView(
                makeText(
                    "Services: $serviceSummary\n" +
                        "Weekly breaks: $breaks\n" +
                        "Time-off periods: $timeOff",
                    14f,
                    muted
                ),
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dp(10)
                }
            )
        } else {
            val price = item.optString("price")
            val duration = item.optInt("duration")

            card.addView(
                makeText(
                    "£$price",
                    26f,
                    orange,
                    true
                ),
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dp(12)
                }
            )

            card.addView(
                makeText(
                    "$duration minutes",
                    14f,
                    muted
                )
            )
        }

        val editButton = Button(this).apply {
            text = "Edit / Delete"
            styleButton(this)
            setOnClickListener {
                options(item)
            }
        }

        card.addView(
            editButton,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(14)
            }
        )

        layout.addView(
            card,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(16)
            }
        )
    }

    private fun addButton(
        label: String,
        action: () -> Unit
    ) {
        val button = Button(this).apply {
            text = label
            styleButton(this)
            setOnClickListener { action() }
        }

        layout.addView(
            button,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(10)
            }
        )
    }

    private fun options(item: JSONObject) {
        AlertDialog.Builder(this)
            .setTitle(item.optString("name"))
            .setItems(
                arrayOf("Edit", "Delete")
            ) { _, choice ->
                if (choice == 0) {
                    edit(item)
                } else {
                    AlertDialog.Builder(this)
                        .setTitle("Delete this entry?")
                        .setMessage(
                            "This permanently deletes the entry " +
                                "from your saved management list. " +
                                "Existing bookings are not changed."
                        )
                        .setPositiveButton("Delete") { _, _ ->
                            records.remove(item)
                            save()
                            render()
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            }
            .show()
    }

    private fun edit(existing: JSONObject?) {
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(
                dp(24), dp(12), dp(24), dp(16)
            )
        }

        fun field(
            label: String,
            initial: String
        ): EditText {
            val input = EditText(this).apply {
                hint = label
                setText(initial)
                setSingleLine(true)
                styleInput(this)
            }
            form.addView(input)
            return input
        }

        fun heading(value: String) {
            form.addView(
                makeText(
                    value,
                    19f,
                    orange,
                    true
                ),
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dp(24)
                    bottomMargin = dp(8)
                }
            )
        }

        val name = field(
            if (staffMode) "Staff name" else "Service name",
            existing?.optString("name") ?: ""
        )

        val second = field(
            if (staffMode) "Role" else "Price (£)",
            existing?.optString(
                if (staffMode) "role" else "price"
            ) ?: ""
        )

        val third = if (!staffMode) {
            field(
                "Duration (minutes)",
                existing?.optString("duration") ?: ""
            ).apply {
                inputType =
                    android.text.InputType.TYPE_CLASS_NUMBER
            }
        } else null

        if (!staffMode) {
            second.inputType =
                android.text.InputType.TYPE_CLASS_NUMBER or
                    android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        }

        val publicCheckbox = CheckBox(this).apply {
            text = "Show on Public Booking Page"
            textSize = 16f
            isChecked = existing?.optBoolean(
                "publicVisible", false
            ) ?: false
            styleCheck(this)
        }

        form.addView(publicCheckbox)

        val availableServices = if (staffMode) {
            loadAvailableServices()
        } else {
            emptyList()
        }

        val selectedIds =
            assignedIds(existing).toMutableSet()

        if (staffMode) {
            heading("Services this staff member performs")

            if (availableServices.isEmpty()) {
                form.addView(
                    makeText(
                        "Add services in Services & Prices first.",
                        14f,
                        muted
                    )
                )
            }

            availableServices.forEach { service ->
                val id = service.optString("id")

                val check = CheckBox(this).apply {
                    text = "${service.optString("name")} — " +
                        "£${service.optString("price")}"
                    isChecked = selectedIds.contains(id)
                    styleCheck(this)
                }

                check.setOnCheckedChangeListener { _, checked ->
                    if (checked) {
                        selectedIds.add(id)
                    } else {
                        selectedIds.remove(id)
                    }
                }

                form.addView(check)
            }
        }

        val dayFields = linkedMapOf<String, DayFields>()

        if (staffMode) {
            heading("Individual Working Hours")

            form.addView(
                makeText(
                    "Tick working days. Use 24-hour HH:mm times.",
                    14f,
                    muted
                )
            )

            val schedule = existingSchedule(existing)

            days.forEach { day ->
                val period = schedule.optJSONObject(day)

                val enabled = CheckBox(this).apply {
                    text = day.replaceFirstChar {
                        it.uppercase()
                    }
                    isChecked = period != null
                    styleCheck(this)
                }

                val opening = EditText(this).apply {
                    hint = "Open"
                    setSingleLine(true)
                    setText(
                        period?.optString("open") ?: "09:00"
                    )
                    styleInput(this)
                }

                val closing = EditText(this).apply {
                    hint = "Close"
                    setSingleLine(true)
                    setText(
                        period?.optString("close") ?: "17:00"
                    )
                    styleInput(this)
                }

                opening.isEnabled = enabled.isChecked
                closing.isEnabled = enabled.isChecked

                enabled.setOnCheckedChangeListener { _, checked ->
                    opening.isEnabled = checked
                    closing.isEnabled = checked
                }

                form.addView(enabled)

                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                }

                row.addView(
                    opening,
                    LinearLayout.LayoutParams(
                        0,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                row.addView(
                    closing,
                    LinearLayout.LayoutParams(
                        0,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                form.addView(row)

                dayFields[day] = DayFields(
                    enabled, opening, closing
                )
            }
        }

        val breakFields = mutableListOf<PeriodFields>()
        val timeOffFields = mutableListOf<PeriodFields>()

        fun addPeriod(
            isWeekly: Boolean,
            saved: JSONObject? = null
        ) {
            val parent = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(
                    dp(12), dp(12), dp(12), dp(12)
                )
                background = rounded(panelColor, 12)
            }

            val daySpinner = if (isWeekly) {
                Spinner(this).apply {
                    adapter = ArrayAdapter(
                        this@ManagementActivity,
                        android.R.layout.simple_spinner_dropdown_item,
                        days.map {
                            it.replaceFirstChar { c ->
                                c.uppercase()
                            }
                        }
                    )

                    val index = days.indexOf(
                        saved?.optString("day") ?: "monday"
                    )

                    setSelection(
                        if (index < 0) 0 else index
                    )
                }
            } else null

            val dateInput = if (!isWeekly) {
                EditText(this).apply {
                    hint = "Date YYYY-MM-DD"
                    setSingleLine(true)
                    setText(
                        saved?.optString("date") ?: ""
                    )
                    styleInput(this)
                }
            } else null

            val start = EditText(this).apply {
                hint = "Start HH:mm"
                setSingleLine(true)
                setText(
                    saved?.optString("start") ?: "12:30"
                )
                styleInput(this)
            }

            val end = EditText(this).apply {
                hint = "End HH:mm"
                setSingleLine(true)
                setText(
                    saved?.optString("end") ?: "13:00"
                )
                styleInput(this)
            }

            val note = EditText(this).apply {
                hint = if (isWeekly) {
                    "Reason (e.g. Lunch)"
                } else {
                    "Reason (e.g. Holiday)"
                }
                setSingleLine(true)
                setText(
                    saved?.optString("reason") ?: ""
                )
                styleInput(this)
            }

            if (daySpinner != null) {
                parent.addView(daySpinner)
            }

            if (dateInput != null) {
                parent.addView(dateInput)
            }

            parent.addView(start)
            parent.addView(end)
            parent.addView(note)

            val entry = PeriodFields(
                parent,
                daySpinner,
                dateInput,
                start,
                end,
                note
            )

            val target = if (isWeekly) {
                breakFields
            } else {
                timeOffFields
            }

            target.add(entry)

            parent.addView(Button(this).apply {
                text = "Remove"
                styleButton(this)

                setOnClickListener {
                    target.remove(entry)
                    (parent.parent as? ViewGroup)
                        ?.removeView(parent)
                }
            })

            form.addView(
                parent,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(12)
                }
            )
        }

        if (staffMode) {
            heading("Recurring Weekly Breaks")

            val savedBreaks =
                existing?.optJSONArray("weeklyBreaks")

            if (savedBreaks != null) {
                for (i in 0 until savedBreaks.length()) {
                    savedBreaks.optJSONObject(i)?.let {
                        addPeriod(true, it)
                    }
                }
            }

            form.addView(Button(this).apply {
                text = "Add Weekly Break"
                styleButton(this)

                setOnClickListener {
                    addPeriod(true)
                }
            })

            heading("Date-Specific Time Off")

            val savedTimeOff =
                existing?.optJSONArray("timeOff")

            if (savedTimeOff != null) {
                for (i in 0 until savedTimeOff.length()) {
                    savedTimeOff.optJSONObject(i)?.let {
                        addPeriod(false, it)
                    }
                }
            }

            form.addView(Button(this).apply {
                text = "Add Time Off"
                styleButton(this)

                setOnClickListener {
                    addPeriod(false)
                }
            })
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(
                if (existing == null) "Add New" else "Edit"
            )
            .setView(ScrollView(this).apply {
                addView(form)
            })
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
            ).setOnClickListener {

                val n = name.text.toString().trim()
                val s = second.text.toString().trim()
                val t = third?.text?.toString()
                    ?.trim() ?: ""

                if (
                    n.isBlank() ||
                    s.isBlank() ||
                    (!staffMode && t.isBlank())
                ) {
                    Toast.makeText(
                        this,
                        "Complete all required fields",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@setOnClickListener
                }

                if (!staffMode && (
                    s.toDoubleOrNull() == null ||
                    !s.toDouble().isFinite() ||
                    s.toDouble() < 0 ||
                    t.toIntOrNull() == null ||
                    t.toInt() <= 0
                )) {
                    Toast.makeText(
                        this,
                        "Invalid price or duration",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@setOnClickListener
                }

                val schedule = JSONObject()
                val weeklyBreaks = JSONArray()
                val timeOff = JSONArray()

                if (staffMode) {
                    for ((day, fields) in dayFields) {
                        if (!fields.enabled.isChecked) {
                            continue
                        }

                        val open = fields.opening.text
                            .toString().trim()

                        val close = fields.closing.text
                            .toString().trim()

                        if (!validPeriod(open, close)) {
                            Toast.makeText(
                                this,
                                "Invalid hours for $day",
                                Toast.LENGTH_LONG
                            ).show()
                            return@setOnClickListener
                        }

                        schedule.put(
                            day,
                            JSONObject().apply {
                                put("open", open)
                                put("close", close)
                            }
                        )
                    }

                    for (entry in breakFields) {
                        val day = days[
                            entry.day!!.selectedItemPosition
                        ]

                        val start = entry.start.text
                            .toString().trim()

                        val end = entry.end.text
                            .toString().trim()

                        val working =
                            schedule.optJSONObject(day)

                        if (
                            !validPeriod(start, end) ||
                            working == null ||
                            parseMinutes(start)!! <
                                parseMinutes(
                                    working.optString("open")
                                )!! ||
                            parseMinutes(end)!! >
                                parseMinutes(
                                    working.optString("close")
                                )!!
                        ) {
                            Toast.makeText(
                                this,
                                "Break must be within working " +
                                    "hours on $day",
                                Toast.LENGTH_LONG
                            ).show()
                            return@setOnClickListener
                        }

                        weeklyBreaks.put(
                            JSONObject().apply {
                                put(
                                    "id",
                                    UUID.randomUUID().toString()
                                )
                                put("day", day)
                                put("start", start)
                                put("end", end)
                                put(
                                    "reason",
                                    entry.note.text
                                        .toString().trim()
                                )
                            }
                        )
                    }

                    for (entry in timeOffFields) {
                        val date = entry.date!!.text
                            .toString().trim()

                        val start = entry.start.text
                            .toString().trim()

                        val end = entry.end.text
                            .toString().trim()

                        if (
                            !validDate(date) ||
                            !validPeriod(start, end)
                        ) {
                            Toast.makeText(
                                this,
                                "Time off requires YYYY-MM-DD " +
                                    "and valid HH:mm times",
                                Toast.LENGTH_LONG
                            ).show()
                            return@setOnClickListener
                        }

                        timeOff.put(
                            JSONObject().apply {
                                put(
                                    "id",
                                    UUID.randomUUID().toString()
                                )
                                put("date", date)
                                put("start", start)
                                put("end", end)
                                put(
                                    "reason",
                                    entry.note.text
                                        .toString().trim()
                                )
                            }
                        )
                    }
                }

                val item = existing ?: JSONObject().apply {
                    put(
                        "id",
                        UUID.randomUUID().toString()
                    )
                }

                item.put("name", n)

                if (staffMode) {
                    item.put("role", s)

                    val ids = JSONArray()
                    selectedIds.forEach {
                        ids.put(it)
                    }

                    item.put("serviceIds", ids)
                    item.put("weeklySchedule", schedule)
                    item.put("weeklyBreaks", weeklyBreaks)
                    item.put("timeOff", timeOff)

                    if (existing == null) {
                        item.put(
                            "hours",
                            "See weekly schedule"
                        )
                    }
                } else {
                    item.put(
                        "price",
                        String.format(
                            Locale.UK,
                            "%.2f",
                            s.toDouble()
                        )
                    )
                    item.put(
                        "duration",
                        t.toInt()
                    )
                }

                item.put(
                    "publicVisible",
                    publicCheckbox.isChecked
                )

                if (existing == null) {
                    records.add(item)
                }

                save()
                dialog.dismiss()
                render()
            }
        }

        dialog.show()
    }
}

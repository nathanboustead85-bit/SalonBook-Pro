package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.graphics.Color
import android.view.ViewGroup
import android.widget.*
import com.google.firebase.auth.FirebaseAuth
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.Locale

class ManagementActivity : Activity() {

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        load()
        render()
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
        } catch (e: Exception) {
            Toast.makeText(
                this,
                "Unable to load saved data",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun loadAvailableServices(): List<JSONObject> {
        val services = mutableListOf<JSONObject>()

        try {
            val array = JSONArray(
                prefs.getString("services", "[]") ?: "[]"
            )

            for (i in 0 until array.length()) {
                val service = array.optJSONObject(i)
                    ?: continue

                if (
                    service.optString("id").isNotBlank() &&
                    service.optString("name").isNotBlank()
                ) {
                    services.add(service)
                }
            }
        } catch (e: Exception) {
            Toast.makeText(
                this,
                "Unable to load services",
                Toast.LENGTH_LONG
            ).show()
        }

        return services
    }

    private fun assignedIds(item: JSONObject?): Set<String> {
        val result = mutableSetOf<String>()
        val array = item?.optJSONArray("serviceIds")
            ?: return result

        for (i in 0 until array.length()) {
            val id = array.optString(i)
            if (id.isNotBlank()) {
                result.add(id)
            }
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

    private fun validTime(value: String): Boolean {
        return parseMinutes(value) != null
    }

    private fun legacySchedule(
        hours: String
    ): JSONObject? {
        val input = hours.trim().lowercase(Locale.ROOT)

        val match = Regex(
            """^(mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(mon|tue|wed|thu|fri|sat|sun))?\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$"""
        ).matchEntire(input) ?: return null

        val startIndex = shortDays.indexOf(
            match.groupValues[1]
        )

        val endIndex = if (
            match.groupValues[2].isBlank()
        ) {
            startIndex
        } else {
            shortDays.indexOf(match.groupValues[2])
        }

        val open = match.groupValues[3]
        val close = match.groupValues[4]

        val openMinutes = parseMinutes(open)
            ?: return null

        val closeMinutes = parseMinutes(close)
            ?: return null

        if (
            startIndex < 0 ||
            endIndex < startIndex ||
            openMinutes >= closeMinutes
        ) {
            return null
        }

        val result = JSONObject()

        for (index in startIndex..endIndex) {
            result.put(
                days[index],
                JSONObject().apply {
                    put("open", open)
                    put("close", close)
                }
            )
        }

        return result
    }

    private fun existingSchedule(
        item: JSONObject?
    ): JSONObject {
        if (item == null) {
            return JSONObject()
        }

        val structured = item.optJSONObject("weeklySchedule")
        if (structured != null) {
            return structured
        }

        return legacySchedule(
            item.optString("hours")
        ) ?: JSONObject()
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

        // Preserve Phase 6B cloud sync.
        if (FirebaseAuth.getInstance()
                .currentUser?.isEmailVerified == true
        ) {
            CloudSyncManager().upload(
                storageKey,
                json
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
        val scroll = ScrollView(this)
        scroll.setBackgroundColor(
            Color.rgb(248, 246, 252)
        )

        layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 45, 32, 40)
        }

        scroll.addView(layout)
        setContentView(scroll)

        addText(
            if (staffMode) "Staff Management"
            else "Services & Prices",
            27f
        )

        addText(
            "Manage your business and choose what " +
                "appears on your public Boustio booking page.",
            15f
        )

        addButton(
            if (staffMode) "Add Staff Member"
            else "Add Service"
        ) {
            edit(null)
        }

        if (records.isEmpty()) {
            addText("Nothing added yet.")
        }

        val serviceNames = if (staffMode) {
            loadAvailableServices().associate {
                it.optString("id") to it.optString("name")
            }
        } else {
            emptyMap()
        }

        records.forEach { item ->
            val visibilityLabel =
                if (item.optBoolean("publicVisible", false)) {
                    "Public: Yes"
                } else {
                    "Public: No"
                }

            val description = if (staffMode) {
                val assigned = assignedIds(item)
                val names = assigned.mapNotNull {
                    serviceNames[it]
                }

                val serviceSummary = when {
                    assigned.isEmpty() -> "None assigned"
                    names.isEmpty() -> "Assigned services unavailable"
                    else -> names.joinToString(", ")
                }

                "${item.optString("name")}\n" +
                    "${item.optString("role")}\n" +
                    "Hours: ${scheduleSummary(item)}\n" +
                    "Services: $serviceSummary\n" +
                    visibilityLabel
            } else {
                "${item.optString("name")}\n" +
                    "£${item.optString("price")} · " +
                    "${item.optInt("duration")} minutes\n" +
                    visibilityLabel
            }

            addText(description)

            addButton("Edit / Delete") {
                options(item)
            }
        }

        addButton("Back to Dashboard") {
            finish()
        }
    }

    private fun addText(
        value: String,
        size: Float = 17f
    ) {
        layout.addView(TextView(this).apply {
            text = value
            textSize = size
            setTextColor(Color.rgb(40, 35, 55))
            setPadding(10, 16, 10, 12)
        })
    }

    private fun addButton(
        label: String,
        action: () -> Unit
    ) {
        layout.addView(
            Button(this).apply {
                text = label
                isAllCaps = false
                setOnClickListener { action() }
            },
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 10
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
                                "Existing bookings are not " +
                                "automatically changed."
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
            setPadding(28, 12, 28, 16)
        }

        fun field(
            label: String,
            initial: String
        ): EditText {
            val input = EditText(this).apply {
                hint = label
                setText(initial)
                setSingleLine(true)
            }
            form.addView(input)
            return input
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
        } else {
            null
        }

        if (!staffMode) {
            second.inputType =
                android.text.InputType.TYPE_CLASS_NUMBER or
                    android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        }

        val publicCheckbox = CheckBox(this).apply {
            text = "Show on Public Booking Page"
            textSize = 16f
            setTextColor(Color.rgb(40, 35, 55))
            isChecked = existing?.optBoolean(
                "publicVisible", false
            ) ?: false
            setPadding(0, 20, 0, 12)
        }
        form.addView(publicCheckbox)

        // Step 7A: Preserve service assignments.
        val availableServices = if (staffMode) {
            loadAvailableServices()
        } else {
            emptyList()
        }

        val selectedServiceIds =
            assignedIds(existing).toMutableSet()

        if (staffMode) {
            form.addView(TextView(this).apply {
                text = "Services this staff member performs"
                textSize = 17f
                setTextColor(Color.rgb(40, 35, 55))
                setPadding(0, 20, 0, 8)
            })

            if (availableServices.isEmpty()) {
                form.addView(TextView(this).apply {
                    text = "Add services in Services & Prices first."
                    textSize = 14f
                })
            } else {
                availableServices.forEach { service ->
                    val id = service.optString("id")
                    val serviceName = service.optString("name")
                    val price = service.optString("price")

                    val checkbox = CheckBox(this).apply {
                        text = "$serviceName — £$price"
                        textSize = 15f
                        isChecked = selectedServiceIds.contains(id)
                    }

                    checkbox.setOnCheckedChangeListener {
                            _, checked ->
                        if (checked) {
                            selectedServiceIds.add(id)
                        } else {
                            selectedServiceIds.remove(id)
                        }
                    }

                    form.addView(checkbox)
                }
            }
        }

        // Step 7B: Individual day-by-day schedules.
        val dayFields = linkedMapOf<String, DayFields>()

        if (staffMode) {
            form.addView(TextView(this).apply {
                text = "Individual Working Hours"
                textSize = 19f
                setTextColor(Color.rgb(40, 35, 55))
                setPadding(0, 24, 0, 8)
            })

            form.addView(TextView(this).apply {
                text = "Tick working days and enter times " +
                    "in 24-hour format (HH:mm)."
                textSize = 14f
            })

            val savedSchedule = existingSchedule(existing)

            days.forEach { day ->
                val period = savedSchedule.optJSONObject(day)

                val enabled = CheckBox(this).apply {
                    text = day.replaceFirstChar {
                        it.uppercase()
                    }
                    textSize = 16f
                    isChecked = period != null
                }

                val opening = EditText(this).apply {
                    hint = "Opening (09:00)"
                    setSingleLine(true)
                    setText(period?.optString("open") ?: "09:00")
                }

                val closing = EditText(this).apply {
                    hint = "Closing (17:00)"
                    setSingleLine(true)
                    setText(period?.optString("close") ?: "17:00")
                }

                opening.isEnabled = enabled.isChecked
                closing.isEnabled = enabled.isChecked

                enabled.setOnCheckedChangeListener {
                        _, checked ->
                    opening.isEnabled = checked
                    closing.isEnabled = checked
                }

                form.addView(enabled)

                val timeRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                }

                timeRow.addView(
                    opening,
                    LinearLayout.LayoutParams(
                        0,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                timeRow.addView(
                    closing,
                    LinearLayout.LayoutParams(
                        0,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                form.addView(timeRow)

                dayFields[day] = DayFields(
                    enabled, opening, closing
                )
            }
        }

        val scrollForm = ScrollView(this).apply {
            addView(form)
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(
                if (existing == null) "Add New" else "Edit"
            )
            .setView(scrollForm)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
            ).setOnClickListener {

                val n = name.text.toString().trim()
                val s = second.text.toString().trim()
                val t = third?.text?.toString()?.trim() ?: ""

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

                if (!staffMode &&
                    (s.toDoubleOrNull() == null ||
                        s.toDouble() < 0 ||
                        t.toIntOrNull() == null ||
                        t.toInt() <= 0)
                ) {
                    Toast.makeText(
                        this,
                        "Invalid price or duration",
                        Toast.LENGTH_SHORT
                    ).show()
                    return@setOnClickListener
                }

                // Validate all hours before changing
                // any saved staff record.
                val newSchedule = JSONObject()

                if (staffMode) {
                    for ((day, fields) in dayFields) {
                        if (!fields.enabled.isChecked) {
                            continue
                        }

                        val open = fields.opening.text
                            .toString().trim()

                        val close = fields.closing.text
                            .toString().trim()

                        if (
                            !validTime(open) ||
                            !validTime(close) ||
                            parseMinutes(open)!! >=
                                parseMinutes(close)!!
                        ) {
                            Toast.makeText(
                                this,
                                "Invalid hours for $day. " +
                                    "Use HH:mm, with closing " +
                                    "later than opening.",
                                Toast.LENGTH_LONG
                            ).show()
                            return@setOnClickListener
                        }

                        newSchedule.put(
                            day,
                            JSONObject().apply {
                                put("open", open)
                                put("close", close)
                            }
                        )
                    }
                }

                val item = existing ?: JSONObject().apply {
                    put("id", UUID.randomUUID().toString())
                }

                item.put("name", n)

                if (staffMode) {
                    item.put("role", s)

                    val ids = JSONArray()
                    selectedServiceIds.forEach { id ->
                        ids.put(id)
                    }
                    item.put("serviceIds", ids)

                    item.put("weeklySchedule", newSchedule)

                    // Preserve the old hours field
                    // for compatibility with existing
                    // local app functionality.
                    // The structured schedule is the
                    // source of truth for Step 7B.
                    if (existing == null) {
                        item.put("hours", "See weekly schedule")
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
                    item.put("duration", t.toInt())
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

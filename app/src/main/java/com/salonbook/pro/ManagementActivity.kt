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
                val service = array.optJSONObject(i) ?: continue

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

    private fun save() {
        val array = JSONArray()
        records.forEach { array.put(it) }

        val json = array.toString()

        // Save locally before uploading.
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
            "Choose which entries should appear " +
                "on your future public Boustio booking page.",
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
                val names = assigned.mapNotNull { serviceNames[it] }

                val serviceSummary = when {
                    assigned.isEmpty() -> "None assigned"
                    names.isEmpty() -> "Assigned services unavailable"
                    else -> names.joinToString(", ")
                }

                "${item.optString("name")}\n" +
                    "${item.optString("role")}\n" +
                    "Hours: ${item.optString("hours")}\n" +
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
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }

        layout.addView(
            button,
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
                            "This permanently deletes the " +
                                "entry from your saved management " +
                                "list. Existing bookings are not " +
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
            setPadding(28, 12, 28, 0)
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

        val third = field(
            if (staffMode) "Working hours"
            else "Duration (minutes)",
            existing?.optString(
                if (staffMode) "hours" else "duration"
            ) ?: ""
        )

        if (!staffMode) {
            second.inputType =
                android.text.InputType.TYPE_CLASS_NUMBER or
                    android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL

            third.inputType =
                android.text.InputType.TYPE_CLASS_NUMBER
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

        // Step 7A: Individual service assignments.
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
                    val serviceId = service.optString("id")
                    val serviceName = service.optString("name")
                    val price = service.optString("price")

                    val checkbox = CheckBox(this).apply {
                        text = "$serviceName — £$price"
                        textSize = 15f
                        isChecked =
                            selectedServiceIds.contains(serviceId)
                    }

                    checkbox.setOnCheckedChangeListener {
                            _, checked ->
                        if (checked) {
                            selectedServiceIds.add(serviceId)
                        } else {
                            selectedServiceIds.remove(serviceId)
                        }
                    }

                    form.addView(checkbox)
                }
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
                val t = third.text.toString().trim()

                if (n.isBlank() || s.isBlank() || t.isBlank()) {
                    Toast.makeText(
                        this,
                        "Complete all fields",
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

                val item = existing ?: JSONObject().apply {
                    put("id", UUID.randomUUID().toString())
                }

                item.put("name", n)

                if (staffMode) {
                    item.put("role", s)
                    item.put("hours", t)

                    // Retain any saved assignments whose
                    // services are temporarily unavailable.
                    val ids = JSONArray()
                    selectedServiceIds.forEach { id ->
                        ids.put(id)
                    }

                    item.put("serviceIds", ids)
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

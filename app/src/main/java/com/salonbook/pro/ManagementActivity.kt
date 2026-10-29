package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.graphics.Color
import android.view.ViewGroup
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

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
                this, "Unable to load saved data",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun save() {
        val array = JSONArray()
        records.forEach { array.put(it) }
        prefs.edit()
            .putString(storageKey, array.toString())
            .apply()
    }

    private fun render() {
        val scroll = ScrollView(this)
        scroll.setBackgroundColor(Color.rgb(248, 246, 252))

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

        addButton(
            if (staffMode) "Add Staff Member"
            else "Add Service"
        ) {
            edit(null)
        }

        if (records.isEmpty()) {
            addText("Nothing added yet.")
        }

        records.forEach { item ->
            val description = if (staffMode) {
                "${item.optString("name")}\n" +
                "${item.optString("role")}\n" +
                "Hours: ${item.optString("hours")}"
            } else {
                "${item.optString("name")}\n" +
                "£${item.optString("price")} · " +
                "${item.optInt("duration")} minutes"
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

        val dialog = AlertDialog.Builder(this)
            .setTitle(
                if (existing == null) "Add New" else "Edit"
            )
            .setView(form)
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
                        this, "Complete all fields",
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
                        this, "Invalid price or duration",
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
                } else {
                    item.put(
                        "price",
                        String.format(
                            java.util.Locale.UK,
                            "%.2f",
                            s.toDouble()
                        )
                    )
                    item.put("duration", t.toInt())
                }

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

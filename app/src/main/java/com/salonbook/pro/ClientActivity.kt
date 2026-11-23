package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.UUID

/** Isolated-device client contacts. Does not modify booking records or Firebase. */
class ClientActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("salonbook_data", MODE_PRIVATE) }
    private val records = mutableListOf<Client>()
    private lateinit var content: LinearLayout
    private val ink = Color.rgb(20, 49, 52)
    private val teal = Color.rgb(0, 139, 131)
    private val muted = Color.rgb(108, 120, 117)
    private var query = ""

    data class Client(val id: String, var name: String, var phone: String,
                      var email: String, var notes: String)

    private fun dp(n: Int) = (n * resources.displayMetrics.density).toInt()
    private fun surface(color: Int = Color.WHITE): GradientDrawable =
        GradientDrawable().apply { setColor(color); cornerRadius = dp(18).toFloat() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        load()
        render()
    }

    private fun load() {
        try {
            val array = JSONArray(prefs.getString("client_records_v1", "[]") ?: "[]")
            val parsed = mutableListOf<Client>()
            for (i in 0 until array.length()) {
                val row = array.getJSONObject(i)
                val name = row.optString("name").trim()
                if (name.isNotEmpty()) parsed.add(Client(row.optString("id"), name,
                    row.optString("phone"), row.optString("email"), row.optString("notes")))
            }
            records.clear()
            records.addAll(parsed)
        } catch (_: Exception) {
            Toast.makeText(this, "Unable to read client records; existing data preserved", Toast.LENGTH_LONG).show()
        }
    }

    private fun persist(): Boolean {
        val array = JSONArray()
        records.forEach { c ->
            array.put(JSONObject().apply {
                put("id", c.id); put("name", c.name); put("phone", c.phone)
                put("email", c.email); put("notes", c.notes)
            })
        }
        return prefs.edit().putString("client_records_v1", array.toString()).commit()
    }

    private fun label(text: String, size: Float, bold: Boolean = false): TextView =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(ink)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(7), 0, dp(7))
        }

    private fun card(title: String, subtitle: String, click: () -> Unit) {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(14), dp(20), dp(14))
            background = surface()
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            contentDescription = title
            setOnClickListener { click() }
        }
        panel.addView(label(title, 18f, true))
        panel.addView(label(subtitle, 13f).apply { setTextColor(muted) })
        content.addView(panel, LinearLayout.LayoutParams(-1, -2).apply {
            bottomMargin = dp(14)
        })
    }

    private fun render() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(249, 250, 248))
            fitsSystemWindows = true
        }
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(28))
        }
        scroll.addView(content)
        root.addView(scroll)
        setContentView(root)
        content.addView(label("Boustio", 26f, true).apply { setTextColor(teal) })
        content.addView(label("Client management", 28f, true))
        content.addView(label("Private client records saved on this test device.", 14f))
        card("+ Add client", "Save a name, phone, email and notes") { edit() }

        val search = EditText(this).apply {
            hint = "Search clients by name"
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT
            setText(query)
            background = surface()
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }
        content.addView(search)
        card("Search", "Filter the directory") {
            query = search.text.toString().trim()
            render()
        }
        if (query.isNotEmpty()) card("Clear search", "Show all saved clients") {
            query = ""
            render()
        }
        val visible = records.filter { it.name.contains(query, ignoreCase = true) }
            .sortedBy { it.name.lowercase(Locale.UK) }
        content.addView(label("CLIENT DIRECTORY • ${records.size} SAVED", 13f, true))
        if (visible.isEmpty()) card(
            if (records.isEmpty()) "No saved clients yet" else "No matching clients",
            "Add a client or try another search."
        ) { edit() }
        visible.forEach { c ->
            val subtitle = listOf(c.phone, c.email).filter { it.isNotBlank() }
                .joinToString(" • ").ifBlank { "Tap to view contact details" }
            card(c.name, subtitle) { details(c.id) }
        }
        card("Back to Boustio", "Return to the main app") { finish() }
    }

    private fun details(id: String) {
        val c = records.firstOrNull { it.id == id } ?: return
        AlertDialog.Builder(this)
            .setTitle(c.name)
            .setMessage(listOf("Phone: ${c.phone.ifBlank { "Not provided" }}",
                "Email: ${c.email.ifBlank { "Not provided" }}",
                "Notes: ${c.notes.ifBlank { "None" }}").joinToString("\n"))
            .setPositiveButton("Edit") { _, _ -> edit(c.id) }
            .setNeutralButton("Delete") { _, _ -> delete(c.id) }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun edit(id: String? = null) {
        val current = records.firstOrNull { it.id == id }
        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(6), dp(20), 0)
        }
        fun field(hintText: String, value: String, kind: Int): EditText =
            EditText(this).apply {
                hint = hintText
                setText(value)
                inputType = kind
                form.addView(this)
            }
        val name = field("Name (required)", current?.name ?: "",
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
        val phone = field("Phone", current?.phone ?: "", InputType.TYPE_CLASS_PHONE)
        val email = field("Email", current?.email ?: "",
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val notes = field("Notes", current?.notes ?: "",
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE)
        val dialog = AlertDialog.Builder(this)
            .setTitle(if (current == null) "Add client" else "Edit client")
            .setView(form)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val n = name.text.toString().trim()
                val p = phone.text.toString().trim()
                val e = email.text.toString().trim()
                val note = notes.text.toString().trim()
                if (n.isEmpty() || n.length > 120 || p.length > 40 ||
                    e.length > 254 || note.length > 2000) {
                    name.error = "Name required; check field lengths"
                    return@setOnClickListener
                }
                if (e.isNotEmpty() && !android.util.Patterns.EMAIL_ADDRESS.matcher(e).matches()) {
                    email.error = "Enter a valid email"
                    return@setOnClickListener
                }
                if (records.any { it.id != current?.id && it.name.equals(n, true) }) {
                    name.error = "This client name already exists"
                    return@setOnClickListener
                }
                val before = records.map { it.copy() }
                if (current == null) records.add(Client(UUID.randomUUID().toString(), n, p, e, note))
                else { current.name = n; current.phone = p; current.email = e; current.notes = note }
                if (!persist()) {
                    records.clear()
                    records.addAll(before)
                    Toast.makeText(this, "Save failed; please retry", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                dialog.dismiss()
                render()
            }
        }
        dialog.show()
    }

    private fun delete(id: String) {
        val c = records.firstOrNull { it.id == id } ?: return
        val bookingArray = try {
            JSONArray(prefs.getString("bookings", "[]") ?: "[]")
        } catch (_: Exception) {
            Toast.makeText(this, "Unable to verify appointment history", Toast.LENGTH_LONG).show()
            return
        }
        for (i in 0 until bookingArray.length()) {
            if (bookingArray.optJSONObject(i)?.optString("client")
                    ?.trim()?.equals(c.name, true) == true) {
                Toast.makeText(this, "Client has bookings; deletion blocked", Toast.LENGTH_LONG).show()
                return
            }
        }
        AlertDialog.Builder(this).setTitle("Delete ${c.name}?")
            .setMessage("Delete this saved contact profile? This cannot be undone.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Delete") { _, _ ->
                val before = records.toList()
                records.removeAll { it.id == id }
                if (!persist()) {
                    records.clear()
                    records.addAll(before)
                    Toast.makeText(this, "Delete failed; please retry", Toast.LENGTH_LONG).show()
                }
                render()
            }.show()
    }
}

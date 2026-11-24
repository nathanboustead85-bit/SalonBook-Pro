package com.salonbook.pro

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.text.TextWatcher
import android.text.Editable
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
    private var sortBy = "Name A-Z"
    private var clientDataReadable = true
    private val mint = Color.rgb(231, 244, 239)

    data class Client(val id: String, var name: String, var phone: String,
                      var email: String, var notes: String)

    private fun dp(n: Int) = (n * resources.displayMetrics.density).toInt()
    private fun surface(color: Int = Color.WHITE): GradientDrawable =
        GradientDrawable().apply { setColor(color); cornerRadius = dp(18).toFloat() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sortBy = prefs.getString("client_directory_sort_v1", "Name A-Z")
            ?.takeIf { it in listOf("Name A-Z", "Name Z-A", "Most appointments") }
            ?: "Name A-Z"
        query = savedInstanceState?.getString("client_directory_query") ?: ""
        load()
        render()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("client_directory_query", query)
        super.onSaveInstanceState(outState)
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
            clientDataReadable = true
        } catch (_: Exception) {
            clientDataReadable = false
            Toast.makeText(this, "Client records unavailable; editing disabled to protect saved data", Toast.LENGTH_LONG).show()
        }
    }

    private fun persist(): Boolean {
        if (!clientDataReadable) return false
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
            setPadding(0, dp(3), 0, dp(3))
        }

    private fun card(title: String, subtitle: String, click: () -> Unit) {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(10), dp(16), dp(10))
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
            bottomMargin = dp(10)
        })
    }

    private fun render() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(249, 250, 248))
            fitsSystemWindows = true
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener { view, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                view.setPadding(0, bars.top, 0, bars.bottom)
                insets
            }
        } else root.fitsSystemWindows = true
        window.navigationBarColor = Color.WHITE
        window.statusBarColor = Color.rgb(249, 250, 248)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        directoryContainer = null
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(14), dp(20), dp(22))
        }
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(bottomNavigation())
        setContentView(root)
        val brand = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(12))
        }
        brand.addView(ImageView(this).apply {
            setImageResource(R.drawable.boustio_mark)
            contentDescription = "Boustio brand mark"
        }, LinearLayout.LayoutParams(dp(44), dp(44)))
        val brandText = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), 0, 0, 0)
        }
        brandText.addView(label("Boustio", 23f, true))
        brandText.addView(label("A booking platform with a difference", 11f).apply {
            setTextColor(teal)
        })
        brand.addView(brandText)
        content.addView(brand)
        content.addView(label("Client management", 25f, true))
        content.addView(label("Private client records saved on this test device.", 14f))
        if (!clientDataReadable) {
            content.addView(label("Client records unavailable. Editing disabled to protect saved data.", 14f, true))
        }
        card("+ Add client", "Save a name, phone, email and notes") { edit() }

        val search = EditText(this).apply {
            hint = "Search name, phone or email"
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT
            setText(query)
            background = surface()
            setPadding(dp(14), dp(10), dp(14), dp(10))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    query = s?.toString()?.trim() ?: ""
                    refreshDirectory()
                }
                override fun afterTextChanged(s: Editable?) {}
            })
        }
        val searchRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        searchRow.addView(search, LinearLayout.LayoutParams(0, dp(52), 1f))
        val clearSearch = Button(this).apply {
            text = "Clear"
            contentDescription = "Clear client search"
            isAllCaps = false
            setTextColor(teal)
            setOnClickListener {
                search.setText("")
                search.clearFocus()
            }
        }
        searchRow.addView(clearSearch, LinearLayout.LayoutParams(dp(88), dp(52)))
        content.addView(searchRow, LinearLayout.LayoutParams(-1, -2).apply {
            bottomMargin = dp(12)
        })
        val sortControl = Spinner(this).apply {
            val options = listOf("Name A-Z", "Name Z-A", "Most appointments")
            adapter = ArrayAdapter(this@ClientActivity,
                android.R.layout.simple_spinner_dropdown_item, options)
            setSelection(options.indexOf(sortBy).coerceAtLeast(0))
            contentDescription = "Sort client directory"
            onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                override fun onItemSelected(parent: android.widget.AdapterView<*>?,
                    view: View?, position: Int, id: Long) {
                    sortBy = options[position]
                    prefs.edit().putString("client_directory_sort_v1", sortBy).apply()
                    refreshDirectory()
                }
            }
        }
        content.addView(label("SORT CLIENTS", 12f, true).apply { setTextColor(teal) })
        content.addView(sortControl, LinearLayout.LayoutParams(-1, dp(48)).apply {
            bottomMargin = dp(6)
        })
        // One-tap recovery to the full A-Z directory without changing client data.
        content.addView(Button(this).apply {
            text = "Reset search and sorting"
            isAllCaps = false
            contentDescription = "Show all clients sorted by name"
            setTextColor(teal)
            setOnClickListener {
                search.setText("")
                search.clearFocus()
                sortControl.setSelection(0)
                sortBy = "Name A-Z"
                prefs.edit().putString("client_directory_sort_v1", sortBy).apply()
                refreshDirectory()
            }
        }, LinearLayout.LayoutParams(-1, dp(48)).apply {
            bottomMargin = dp(12)
        })
        val directory = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(directory)
        directoryContainer = directory
        refreshDirectory()
    }

    private var directoryContainer: LinearLayout? = null

    private fun refreshDirectory() {
        val target = directoryContainer ?: return
        target.removeAllViews()
        // Read appointment names once per refresh rather than parsing bookings for every row.
        val bookingNames = readBookingNames()
        val appointmentCounts = bookingNames.groupingBy { it.lowercase(Locale.UK) }.eachCount()
        fun countFor(name: String) = appointmentCounts[name.lowercase(Locale.UK)] ?: 0
        val directoryNames = (records.map { it.name } + bookingNames)
             .distinctBy { it.lowercase(Locale.UK) }
        // Ignore repeated whitespace and letter case when matching names and contact details.
        fun normalized(value: String) = value.trim().replace(Regex("\\s+"), " ")
            .lowercase(Locale.UK)
        val normalizedQuery = normalized(query)
        val matching = directoryNames.filter { name ->
            val contact = records.firstOrNull { it.name.equals(name, ignoreCase = true) }
            normalized(name).contains(normalizedQuery) ||
                (contact?.phone?.let { normalized(it).contains(normalizedQuery) } == true) ||
                (contact?.email?.let { normalized(it).contains(normalizedQuery) } == true)
        }
        val visible = when (sortBy) {
            "Name Z-A" -> matching.sortedWith(compareByDescending(String.CASE_INSENSITIVE_ORDER) { it })
            "Most appointments" -> matching.sortedWith(
                compareByDescending<String> { countFor(it) }
                    .thenBy(String.CASE_INSENSITIVE_ORDER) { it })
            else -> matching.sortedWith(String.CASE_INSENSITIVE_ORDER)
        }
        fun clientLabel(count: Int) = if (count == 1) "1 client" else "$count clients"
        target.addView(label("CLIENT DIRECTORY • ${clientLabel(directoryNames.size).uppercase(Locale.UK)}", 13f, true))
        target.addView(label(
            if (query.isNotBlank()) "Showing ${clientLabel(visible.size)} of ${clientLabel(directoryNames.size)} • Sorted: $sortBy"
            else "Showing all ${clientLabel(visible.size)} • Sorted: $sortBy", 13f
        ).apply {
            setTextColor(teal)
            contentDescription = "Client directory results: ${clientLabel(visible.size)} of ${clientLabel(directoryNames.size)}. Sorting: $sortBy"
        })
        if (visible.isEmpty()) {
            val emptyMessage = when {
                !clientDataReadable -> "Saved client records are unavailable. Editing is disabled; do not clear app data."
                directoryNames.isEmpty() -> "No clients yet — add a client above."
                query.isNotBlank() -> "No clients match your search. Try a shorter name, phone number or email, or tap Reset search and sorting above to show everyone."
                else -> "No clients to display."
            }
            target.addView(label(emptyMessage, 15f))
        }
        fun appointmentLabel(count: Int) = if (count == 1) "1 appointment" else "$count appointments"
        // Alphabetical section markers improve scanning without changing client order.
        var previousSection: String? = null
        visible.forEach { name ->
            if (sortBy != "Most appointments") {
                val section = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "#"
                if (section != previousSection) {
                    target.addView(label(section, 13f, true).apply {
                        setTextColor(teal)
                        contentDescription = "Client names beginning with $section"
                    })
                    previousSection = section
                }
            }
            val c = records.firstOrNull { it.name.equals(name, ignoreCase = true) }
            val count = countFor(name)
            val subtitle = listOfNotNull(
                c?.phone?.takeIf { it.isNotBlank() }?.let { "Phone: $it" },
                c?.email?.takeIf { it.isNotBlank() }?.let { "Email: $it" },
                appointmentLabel(count)
            ).joinToString(" • ")
            val panel = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(10), dp(16), dp(10))
                background = surface()
                elevation = dp(2).toFloat()
                isClickable = true
                isFocusable = true
                contentDescription = if (c != null)
                    "Open client profile for $name. ${appointmentLabel(count)}."
                else "View appointment history for $name. ${appointmentLabel(count)}."
                setOnClickListener { if (c != null) details(c.id) else appointmentHistory(name) }
            }
            panel.addView(label(name, 17f, true))
            panel.addView(label(subtitle, 13f).apply { setTextColor(muted) })
            target.addView(panel, LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = dp(10)
            })
        }
        target.addView(label("APPOINTMENT HISTORY", 13f, true))
        val total = directoryNames.sumOf { countFor(it) }
        target.addView(label(if (total == 0) "No appointments on this test installation."
            else "${appointmentLabel(total)} — tap a client to view history.", 14f))

    }

    private fun readBookingNames(): List<String> {
        return try {
            val array = JSONArray(prefs.getString("bookings", "[]") ?: "[]")
            (0 until array.length()).mapNotNull { i ->
                array.optJSONObject(i)?.optString("client")?.trim()?.takeIf { it.isNotBlank() }
            }
        } catch (_: Exception) { emptyList() }
    }

    private fun bookingCount(name: String): Int {
        return try {
            val array = JSONArray(prefs.getString("bookings", "[]") ?: "[]")
            (0 until array.length()).count { i ->
                array.optJSONObject(i)?.optString("client")?.trim()?.equals(name, true) == true
            }
        } catch (_: Exception) { 0 }
    }

    private fun appointmentHistory(name: String) {
        val array = try {
            JSONArray(prefs.getString("bookings", "[]") ?: "[]")
        } catch (_: Exception) {
            Toast.makeText(this, "Unable to load appointment history", Toast.LENGTH_LONG).show()
            return
        }
        val entries = (0 until array.length()).mapNotNull { i ->
            val booking = array.optJSONObject(i) ?: return@mapNotNull null
            if (!booking.optString("client").trim().equals(name, true)) return@mapNotNull null
            booking
        }.sortedWith(compareByDescending<JSONObject> {
            it.optString("date") + " " + it.optString("time")
        })
        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(8), dp(18), dp(8))
        }
        list.addView(label("${appointmentLabel(entries.size)}", 14f, true).apply {
            setTextColor(teal)
        })
        if (entries.isEmpty()) {
            list.addView(label("No appointments recorded for this client.", 15f))
        } else {
            entries.forEach { booking ->
                val panel = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(14), dp(10), dp(14), dp(10))
                    background = surface(mint)
                }
                val dateTime = listOf(booking.optString("date"), booking.optString("time"))
                    .filter { it.isNotBlank() }.joinToString(" • ")
                panel.addView(label(dateTime.ifBlank { "Date not provided" }, 15f, true))
                panel.addView(label(booking.optString("service").ifBlank { "Service not provided" }, 14f))
                list.addView(panel, LinearLayout.LayoutParams(-1, -2).apply {
                    bottomMargin = dp(9)
                })
            }
        }
        val scroll = ScrollView(this).apply { addView(list) }
        AlertDialog.Builder(this).setTitle("Appointment history • $name")
            .setView(scroll)
            .setPositiveButton("Close", null)
            .setNeutralButton("Client profile") { _, _ ->
                val record = records.firstOrNull { it.name.equals(name, true) }
                if (record != null) details(record.id) else edit(prefillName = name)
            }.show()
    }

    private fun bottomNavigation(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setBackgroundColor(Color.WHITE)
        setPadding(dp(6), dp(6), dp(6), dp(6))
        elevation = dp(8).toFloat()
        listOf(
            Triple(R.drawable.nav_home, "Home", false),
            Triple(R.drawable.nav_calendar, "Calendar", false),
            Triple(R.drawable.nav_clients, "Clients", true),
            Triple(R.drawable.nav_settings, "Settings", false)
        ).forEach { (icon, title, selected) ->
            val tab = LinearLayout(this@ClientActivity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                background = surface(if (selected) mint else Color.WHITE)
                setPadding(0, dp(3), 0, dp(3))
                isClickable = true
                isFocusable = true
                contentDescription = title
                setOnClickListener {
                    if (selected) render() else {
                        startActivity(Intent(this@ClientActivity, MainActivity::class.java)
                            .putExtra("boustio_tab", title)
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
                        finish()
                    }
                }
            }
            tab.addView(ImageView(this@ClientActivity).apply {
                setImageResource(icon)
                setColorFilter(if (selected) teal else muted)
            }, LinearLayout.LayoutParams(dp(25), dp(25)))
            tab.addView(label(title, 11f, selected).apply {
                gravity = Gravity.CENTER
                setPadding(0, dp(3), 0, 0)
                setTextColor(if (selected) teal else muted)
            })
            addView(tab, LinearLayout.LayoutParams(0, dp(60), 1f))
        }
    }

    private fun details(id: String) {
        val c = records.firstOrNull { it.id == id } ?: return
        val profile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(10), dp(20), dp(10))
        }
        profile.addView(label("CONTACT DETAILS", 12f, true).apply { setTextColor(teal) })
        profile.addView(label("Phone", 12f).apply { setTextColor(muted) })
        profile.addView(label(c.phone.ifBlank { "Not provided" }, 16f))
        profile.addView(label("Email", 12f).apply { setTextColor(muted) })
        profile.addView(label(c.email.ifBlank { "Not provided" }, 16f))
        profile.addView(label("CLIENT NOTES", 12f, true).apply { setTextColor(teal) })
        profile.addView(label(c.notes.ifBlank { "No notes saved" }, 15f))
        profile.addView(label("${appointmentLabel(bookingCount(c.name))} • View history below", 13f).apply {
            setTextColor(muted)
        })
        val dialog = AlertDialog.Builder(this)
            .setTitle(c.name)
            .setView(ScrollView(this).apply { addView(profile) })
            .setPositiveButton("Edit") { _, _ -> edit(c.id) }
            .setNeutralButton("History") { _, _ -> appointmentHistory(c.name) }
            .setNegativeButton("More", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener {
                AlertDialog.Builder(this)
                    .setTitle("Client actions")
                    .setItems(arrayOf("Delete client", "Cancel")) { _, choice ->
                        if (choice == 0) { dialog.dismiss(); delete(c.id) }
                    }.show()
            }
        }
        dialog.show()
    }

    private fun edit(id: String? = null, prefillName: String = "") {
        if (!clientDataReadable) {
            Toast.makeText(this, "Editing unavailable until client data can be read safely", Toast.LENGTH_LONG).show()
            return
        }
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
        val name = field("Name (required)", current?.name ?: prefillName,
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
        if (!clientDataReadable) {
            Toast.makeText(this, "Deletion unavailable until client data can be read safely", Toast.LENGTH_LONG).show()
            return
        }
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

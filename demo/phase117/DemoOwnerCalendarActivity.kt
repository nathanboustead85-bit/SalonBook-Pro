package uk.co.boustio.demo.phase117

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.EditText
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Development reference only. Lives outside app/src and is NOT compiled into any APK.
 * Attach a trusted, emulator-only transport in a separate debug build before device testing.
 */
class DemoOwnerCalendarActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var appointments: LinearLayout
    private val rows = linkedMapOf<String, DemoAppointment>()
    private val london = ZoneId.of("Europe/London")
    private val format = DateTimeFormatter.ofPattern("EEE d MMM, HH:mm")
    private var active = false
    private val handler = Handler(Looper.getMainLooper())
    private var epoch = 0
    private lateinit var businessInput: EditText
    private lateinit var dateInput: EditText
    private lateinit var tokenInput: EditText

    data class DemoAppointment(
        val id: String,
        val startAt: String,
        val serviceId: String,
        val staffId: String,
        val status: String,
        val source: String = "demo_customer_web"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 28, 28, 28)
        }
        root.addView(TextView(this).apply { text = "BOUSTIO • EMULATOR DEMO ONLY"; textSize = 20f })
        status = TextView(this).apply { text = "Disconnected"; textSize = 16f }
        root.addView(status)
        fun field(hint: String): EditText = EditText(this).also { it.hint = hint; root.addView(it) }
        businessInput = field("Synthetic business ID (demo_...)")
        dateInput = field("YYYY-MM-DD")
        tokenInput = field("Verified emulator owner ID token")
        root.addView(Button(this).apply { text = "Connect demo calendar"; setOnClickListener { epoch++; active = true; poll(epoch) } })
        appointments = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(ScrollView(this).apply { addView(appointments) })
        setContentView(root)
    }

    override fun onStart() {
        super.onStart()
        active = true
        status.text = "Awaiting emulator-only calendar connection"
        // Explicit Connect is required: no automatic production network access.
    }

    fun showConnectionState(value: String) {
        runOnUiThread { if (active) status.text = value }
    }

    fun showSnapshot(items: List<DemoAppointment>) {
        require(items.all { it.source == "demo_customer_web" && it.status in setOf("confirmed", "cancelled") })
        require(items.map { it.id }.distinct().size == items.size)
        runOnUiThread {
            if (!active) return@runOnUiThread
            rows.clear()
            items.forEach { rows[it.id] = it }
            appointments.removeAllViews()
            rows.values.sortedWith(compareBy({ it.startAt }, { it.id })).forEach { item ->
                val whenLondon = Instant.parse(item.startAt).atZone(london).format(format)
                appointments.addView(TextView(this).apply {
                    text = "$whenLondon • ${item.serviceId} • ${item.staffId} • ${item.status.uppercase()}"
                    textSize = 16f
                    setPadding(0, 18, 0, 18)
                })
            }
            if (rows.isEmpty()) appointments.addView(TextView(this).apply { text = "No demo appointments" })
        }
    }

    private fun poll(current: Int) {
        if (!active || current != epoch) return
        val business = businessInput.text.toString()
        val date = dateInput.text.toString()
        val token = tokenInput.text.toString()
        Thread {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL("http://10.0.2.2:8765/demo/calendar").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"; connectTimeout = 2500; readTimeout = 2500
                    doOutput = true; setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().put("businessId", business).put("date", date).put("ownerToken", token)
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                if (conn.responseCode != 200) error("Owner access denied")
                val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                val array = json.getJSONArray("appointments")
                val items = (0 until array.length()).map { i ->
                    val o = array.getJSONObject(i)
                    DemoAppointment(o.getString("id"), o.getString("startAt"), o.getString("serviceId"),
                        o.getString("staffId"), o.getString("status"), o.getString("source"))
                }
                if (active && current == epoch) {
                    showSnapshot(items)
                    showConnectionState("Connected • ${items.size} demo appointments")
                }
            } catch (_: Exception) {
                if (active && current == epoch) showConnectionState("Disconnected • retrying")
            } finally { conn?.disconnect() }
            handler.post { if (active && current == epoch) handler.postDelayed({ poll(current) }, 5000L) }
        }.start()
    }

    override fun onStop() {
        active = false
        epoch++
        handler.removeCallbacksAndMessages(null)
        super.onStop()
    }
}

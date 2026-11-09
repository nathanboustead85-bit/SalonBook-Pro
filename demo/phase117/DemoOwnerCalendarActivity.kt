package uk.co.boustio.demo.phase117

import android.app.Activity
import android.os.Bundle
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
        appointments = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(ScrollView(this).apply { addView(appointments) })
        setContentView(root)
    }

    override fun onStart() {
        super.onStart()
        active = true
        status.text = "Awaiting emulator-only calendar connection"
        // Debug-only transport should subscribe here, and invoke showSnapshot on the UI thread.
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

    override fun onStop() {
        active = false
        // Debug transport must unsubscribe and cancel retries here.
        super.onStop()
    }
}

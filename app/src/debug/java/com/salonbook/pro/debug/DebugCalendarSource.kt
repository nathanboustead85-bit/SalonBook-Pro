package com.salonbook.pro.debug

import com.salonbook.pro.CalendarFeedItem
import com.salonbook.pro.CalendarFeedState
import com.salonbook.pro.DevelopmentCalendarSource

/**
 * Explicitly opt-in emulator session. Credentials remain in memory only.
 * No configuration means no network calls and no invented appointments.
 */
class DebugCalendarSource(private val context: android.content.Context) : DevelopmentCalendarSource {
    companion object {
        @Volatile private var demoBusiness: String? = null
        @Volatile private var demoOwnerToken: String? = null
        fun configureForEmulator(business: String, token: String) {
            require(Regex("demo_[A-Za-z0-9_-]{3,75}").matches(business))
            require(token.isNotBlank())
            demoBusiness = business
            demoOwnerToken = token
        }
        fun clear() { demoBusiness = null; demoOwnerToken = null }
    }
    private val session = UnifiedCalendarSession()
    private val cache = DebugCalendarDiskCache(context)
    override fun display(date: String, onChange: (CalendarFeedState) -> Unit) {
        session.stop()
        val id = demoBusiness
        val token = demoOwnerToken
        if (id == null || token == null) {
            onChange(CalendarFeedState("Emulator not connected • no website bookings loaded", emptyList()))
            return
        }
        cache.load(id, date)?.let { saved ->
            onChange(CalendarFeedState("Saved emulator preview • awaiting refresh", saved.map {
                CalendarFeedItem(it.id, it.time, it.service, it.staff, it.status)
            }))
        }
        session.start(id, token, date) { state ->
            if (state.connected) runCatching { cache.save(id, date, state.appointments) }
            val shown = if (state.connected) state.appointments else cache.load(id, date).orEmpty()
            val message = if (!state.connected && shown.isNotEmpty()) "Offline • saved emulator preview (not live)" else state.message
            onChange(CalendarFeedState(message, shown.map {
                CalendarFeedItem(it.id, it.time, it.service, it.staff, it.status)
            }))
        }
    }
    override fun stop() { session.stop() }
}

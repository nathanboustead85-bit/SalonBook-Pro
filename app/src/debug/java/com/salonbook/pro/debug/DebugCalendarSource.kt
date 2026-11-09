package com.salonbook.pro.debug

import com.salonbook.pro.CalendarFeedItem
import com.salonbook.pro.CalendarFeedState
import com.salonbook.pro.DevelopmentCalendarSource

/**
 * Explicitly opt-in emulator session. Credentials remain in memory only.
 * No configuration means no network calls and no invented appointments.
 */
class DebugCalendarSource : DevelopmentCalendarSource {
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
    override fun display(date: String, onChange: (CalendarFeedState) -> Unit) {
        session.stop()
        val id = demoBusiness
        val token = demoOwnerToken
        if (id == null || token == null) {
            onChange(CalendarFeedState("Emulator not connected • no website bookings loaded", emptyList()))
            return
        }
        session.start(id, token, date) { state ->
            onChange(CalendarFeedState(state.message, state.appointments.map {
                CalendarFeedItem(it.id, it.time, it.service, it.staff, it.status)
            }))
        }
    }
    override fun stop() { session.stop() }
}

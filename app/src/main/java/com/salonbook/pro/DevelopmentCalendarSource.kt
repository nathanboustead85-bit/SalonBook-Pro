package com.salonbook.pro

/** Contract compiled into the existing calendar; implemented only in debug builds. */
interface DevelopmentCalendarSource {
    fun display(date: String, onChange: (CalendarFeedState) -> Unit)
    fun stop()
}
data class CalendarFeedItem(val id: String, val time: String, val service: String, val staff: String, val status: String)
data class CalendarFeedState(val message: String, val items: List<CalendarFeedItem>)

package com.salonbook.pro
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.text.ParsePosition

object FriendlyDate {
    private fun iso() = SimpleDateFormat("yyyy-MM-dd", Locale.UK).apply { isLenient = false }
    private fun parse(value: String): java.util.Date? {
        if (!Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}").matches(value)) return null
        val pos = ParsePosition(0)
        val date = iso().parse(value, pos)
        return if (pos.index == value.length) date else null
    }
    fun format(value: String, pattern: String = "EEEE, d MMM yyyy"): String =
        parse(value)?.let { SimpleDateFormat(pattern, Locale.UK).format(it) } ?: value
    fun shift(value: String, days: Int): String {
        val date = parse(value) ?: return value
        val calendar = Calendar.getInstance().apply { time = date; add(Calendar.DAY_OF_MONTH, days) }
        return iso().format(calendar.time)
    }
}

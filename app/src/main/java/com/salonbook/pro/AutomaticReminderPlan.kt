package com.salonbook.pro

/** Pure offline planning; no queue, alarm, network or delivery side effects. */
internal object AutomaticReminderPlan {
    data class Window(val type: NotificationPreferences.ReminderType, val dueAtMillis: Long)
    fun windows(appointmentAtMillis: Long, nowMillis: Long, settings: NotificationPreferences.BusinessSettings): List<Window> {
        if (nowMillis <= 0L || appointmentAtMillis <= nowMillis || !settings.emailRemindersEnabled) return emptyList()
        val result = mutableListOf<Window>()
        fun add(enabled: Boolean, type: NotificationPreferences.ReminderType, lead: Long) {
            if (enabled && appointmentAtMillis > lead) {
                val due = appointmentAtMillis - lead
                if (due >= nowMillis) result.add(Window(type, due))
            }
        }
        add(settings.reminder24HoursEnabled, NotificationPreferences.ReminderType.HOURS_24, 86400000L)
        add(settings.reminder2HoursEnabled, NotificationPreferences.ReminderType.HOURS_2, 7200000L)
        return result.toList()
    }
}

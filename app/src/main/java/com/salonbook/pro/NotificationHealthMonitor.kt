package com.salonbook.pro

/** Process-local, identifier-free health state. No alerts or network calls. */
internal class NotificationHealthMonitor {
    enum class State { HEALTHY, DEGRADED, CRITICAL }
    enum class Signal { NONE, DEGRADED, CRITICAL, RECOVERED }
    private var failures = 0
    private var state = State.HEALTHY
    @Synchronized fun snapshot(): State = state
    @Synchronized fun record(result: PersistentReminderPreviewLedger.Result): Signal {
        val previous = state
        when (result) {
            PersistentReminderPreviewLedger.Result.REJECTED -> return Signal.NONE
            PersistentReminderPreviewLedger.Result.CLAIMED -> { failures = 0; state = State.HEALTHY }
            PersistentReminderPreviewLedger.Result.STORAGE_FAILURE -> {
                failures = (failures + 1).coerceAtMost(3)
                state = if (failures >= 3) State.CRITICAL else State.DEGRADED
            }
        }
        if (previous == state) return Signal.NONE
        return when (state) {
            State.HEALTHY -> Signal.RECOVERED
            State.DEGRADED -> Signal.DEGRADED
            State.CRITICAL -> Signal.CRITICAL
        }
    }
}

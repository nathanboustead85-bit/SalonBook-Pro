package com.salonbook.pro

/** Single-event, process-local retry controller. Durable claim ledger remains authoritative.
 * Never retries an ambiguous outcome as a delivery. No timers or external side effects.
 */
internal class ReminderRecoveryPreview(private val due: Long) {
    enum class Outcome { CLAIMED, REJECTED, WAIT, EXHAUSTED, EXPIRED, UNKNOWN }
    private var attempts = 0
    private var next = due
    private var last = 0L
    private var terminal: Outcome? = null
    @Synchronized fun attempt(now: Long, operation: () -> PersistentReminderPreviewLedger.Result): Outcome {
        terminal?.let { return it }
        if (due <= 0 || now <= 0 || now < last) {
            terminal = Outcome.UNKNOWN
            return Outcome.UNKNOWN
        }
        last = now
        if (now < due || now < next) return Outcome.WAIT
        if (now - due > ReminderExecutionPreview.MAX_LATENESS) {
            terminal = Outcome.EXPIRED
            return Outcome.EXPIRED
        }
        attempts++
        val result = try { operation() } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            terminal = Outcome.UNKNOWN
            return Outcome.UNKNOWN
        } catch (e: Exception) {
            terminal = Outcome.UNKNOWN
            return Outcome.UNKNOWN
        }
        val outcome = when (result) {
            PersistentReminderPreviewLedger.Result.CLAIMED -> Outcome.CLAIMED
            PersistentReminderPreviewLedger.Result.REJECTED -> Outcome.REJECTED
            PersistentReminderPreviewLedger.Result.STORAGE_FAILURE -> {
                if (attempts >= 3) Outcome.EXHAUSTED else {
                    val delay = if (attempts == 1) 30000L else 120000L
                    if (now > Long.MAX_VALUE - delay || now - due + delay > ReminderExecutionPreview.MAX_LATENESS) Outcome.EXPIRED
                    else { next = now + delay; return Outcome.WAIT }
                }
            }
        }
        terminal = outcome
        return outcome
    }
}

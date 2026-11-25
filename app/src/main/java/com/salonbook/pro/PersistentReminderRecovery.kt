package com.salonbook.pro

import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline retry reservations. An interrupted reservation is terminal UNKNOWN.
 * No delivery or timers. Caller must revalidate eligibility on every claim.
 */
internal class PersistentReminderRecovery(private val directory: File) {
    private data class State(val due: Long, val attempts: Int, val next: Long, val last: Long, val outcome: ReminderRecoveryPreview.Outcome)
    companion object {
        private val lock = Any()
        private val hex = Regex("[0-9a-f]{64}")
        private fun digest(s: String) = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private fun read(file: AtomicFile, due: Long): State? {
        return try {
            val base = file.baseFile
            val backup = File(base.path+".bak")
            val committed = if (backup.exists()) backup else base
            if (!committed.exists()) {
                if (File(base.path+".new").exists()) null else State(due,0,due,0,ReminderRecoveryPreview.Outcome.WAIT)
            } else {
                if (!committed.isFile || committed.length() > 512) return null
                val p = file.readFully().toString(Charsets.UTF_8).split("\n")
                if (p.size != 7 || p[0] != "BOUSTIO-REMINDER-RETRY-1" || digest(p.take(6).joinToString("\n")) != p[6]) return null
                val s = State(p[1].toLong(),p[2].toInt(),p[3].toLong(),p[4].toLong(),ReminderRecoveryPreview.Outcome.valueOf(p[5]))
                if (s.due != due || s.attempts !in 0..3 || s.next < due || s.last < 0 || (s.outcome == ReminderRecoveryPreview.Outcome.WAIT && s.attempts >= 3)) null else s
            }
        } catch (e: Exception) { null }
    }
    private fun write(file: AtomicFile, s: State): Boolean {
        val payload = listOf("BOUSTIO-REMINDER-RETRY-1",s.due,s.attempts,s.next,s.last,s.outcome.name).joinToString("\n")
        val bytes = (payload+"\n"+digest(payload)).toByteArray(Charsets.UTF_8)
        return try {
            val stream = file.startWrite()
            try { stream.write(bytes); stream.fd.sync(); file.finishWrite(stream) }
            catch (e: Exception) { file.failWrite(stream); return false }
            file.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    fun attempt(event: ReminderSchedulePreview.Event, now: Long, operation: () -> PersistentReminderPreviewLedger.Result): ReminderRecoveryPreview.Outcome = synchronized(lock) {
        val unknown = ReminderRecoveryPreview.Outcome.UNKNOWN
        val due = event.window.dueAtMillis
        if (!directory.isDirectory || !hex.matches(event.id) || due <= 0 || now <= 0) return@synchronized unknown
        val file = AtomicFile(File(directory,"reminder-retry-${event.id}.state"))
        val s = read(file,due) ?: return@synchronized unknown
        if (s.outcome != ReminderRecoveryPreview.Outcome.WAIT) return@synchronized s.outcome
        if (now < s.last) {
            write(file,s.copy(outcome=unknown))
            return@synchronized unknown
        }
        if (now < due || now < s.next) return@synchronized ReminderRecoveryPreview.Outcome.WAIT
        if (now-due > ReminderExecutionPreview.MAX_LATENESS) {
            return@synchronized if (write(file,s.copy(last=now,outcome=ReminderRecoveryPreview.Outcome.EXPIRED))) ReminderRecoveryPreview.Outcome.EXPIRED else unknown
        }
        val reserved = s.copy(attempts=s.attempts+1,last=now,outcome=unknown)
        if (!write(file,reserved)) return@synchronized unknown
        val result = try { operation() } catch (e: InterruptedException) {
            Thread.currentThread().interrupt(); return@synchronized unknown
        } catch (e: Exception) { return@synchronized unknown }
        val final = when(result) {
            PersistentReminderPreviewLedger.Result.CLAIMED -> reserved.copy(outcome=ReminderRecoveryPreview.Outcome.CLAIMED)
            PersistentReminderPreviewLedger.Result.REJECTED -> reserved.copy(outcome=ReminderRecoveryPreview.Outcome.REJECTED)
            PersistentReminderPreviewLedger.Result.STORAGE_FAILURE -> {
                val delay = if (reserved.attempts == 1) 30000L else 120000L
                when {
                    reserved.attempts >= 3 -> reserved.copy(outcome=ReminderRecoveryPreview.Outcome.EXHAUSTED)
                    now > Long.MAX_VALUE-delay || now-due+delay > ReminderExecutionPreview.MAX_LATENESS -> reserved.copy(outcome=ReminderRecoveryPreview.Outcome.EXPIRED)
                    else -> reserved.copy(next=now+delay,outcome=ReminderRecoveryPreview.Outcome.WAIT)
                }
            }
        }
        if (write(file,final)) final.outcome else unknown
    }
}

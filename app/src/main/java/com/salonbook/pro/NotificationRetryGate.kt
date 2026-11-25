package com.salonbook.pro

import android.util.AtomicFile
import android.os.SystemClock
import java.util.UUID
import java.io.File
import java.security.MessageDigest

/** Offline, process-wide serialization. No timers, delivery, or customer identifiers. */
internal class NotificationRetryGate(directory: File, private val elapsed: () -> Long = { SystemClock.elapsedRealtime() }) {
    companion object {
        private val lock = Any()
        private val processEpoch = UUID.randomUUID().toString()
        private val delays = longArrayOf(30_000L, 120_000L, 600_000L)
        private const val LIMIT = 4
        private const val COOLDOWN = 3_600_000L
        private fun hash(s: String) = MessageDigest.getInstance("SHA-256")
            .digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private val diagnostics = NotificationRecoveryDiagnostics(directory)
    private var diagnosticFault = false
    fun recoveryState(): NotificationRecoveryDiagnostics.Snapshot = synchronized(lock) {
        try {
            if (diagnosticFault) NotificationRecoveryDiagnostics.Snapshot(3, 3, NotificationRecoveryDiagnostics.Severity.CRITICAL)
            else diagnostics.snapshot()
        } catch (e: Exception) {
            diagnosticFault = true
            NotificationRecoveryDiagnostics.Snapshot(3, 3, NotificationRecoveryDiagnostics.Severity.CRITICAL)
        }
    }
    private fun recordDiagnostic(event: NotificationRecoveryDiagnostics.Event) {
        try {
            diagnostics.record(event)
            diagnosticFault = false
        } catch (e: Exception) { diagnosticFault = true }
    }
    private val file = AtomicFile(File(directory, "notification-retry-v1.state"))
    private data class State(val attempts: Int, val until: Long, val epoch: String = "legacy")
    private fun read(): State? {
        return try {
            val backup = File(file.baseFile.path + ".bak")
            val committed = if (backup.exists()) backup else file.baseFile
            if (!committed.exists()) {
                if (File(file.baseFile.path + ".new").exists()) null else State(0, 0, "empty")
            } else if (!committed.isFile || committed.length() > 160) null
            else {
                val parts = file.readFully().toString(Charsets.UTF_8).split("\n")
                val n = parts.getOrNull(1)?.toIntOrNull()
                val until = parts.getOrNull(2)?.toLongOrNull()
                if (parts.size == 4 && parts[0] == "BOUSTIO-RETRY-1" && n != null && n in 0..LIMIT &&
                    until != null && until >= 0 && parts[3] == hash(parts.take(3).joinToString("\n"))) State(n, until) else if (parts.size == 5 && parts[0] == "BOUSTIO-RETRY-2" && n != null && n in 0..LIMIT && until != null && until >= 0 && parts[3].length in 1..36 && parts[4] == hash(parts.take(4).joinToString("\n"))) State(n, until, parts[3]) else null
            }
        } catch (e: Exception) { null }
    }
    private fun write(state: State): Boolean {
        val payload = "BOUSTIO-RETRY-2\n${state.attempts}\n${state.until}\n${state.epoch}"
        val bytes = (payload + "\n" + hash(payload)).toByteArray(Charsets.UTF_8)
        return try {
            val stream = file.startWrite()
            try {
                stream.write(bytes)
                stream.fd.sync()
                file.finishWrite(stream)
            } catch (e: Exception) {
                file.failWrite(stream)
                return false
            }
            file.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    fun attempt(now: Long, operation: () -> PersistentReminderPreviewLedger.Result) =
        attemptInEpoch(now, "legacy", operation)

    fun attemptMonotonic(operation: () -> PersistentReminderPreviewLedger.Result) =
        try { attemptInEpoch(elapsed(), processEpoch, operation) } catch (e: Exception) { null }

    internal fun attemptInEpoch(now: Long, epoch: String, operation: () -> PersistentReminderPreviewLedger.Result): PersistentReminderPreviewLedger.Result? = synchronized(lock) {
        if (now < 0 || now > Long.MAX_VALUE - COOLDOWN) return@synchronized null
        val saved = read()
        // Unknown history or a deadline beyond the maximum permitted interval:
        // persist a conservative cooldown before allowing any further operation.
        if (saved == null || (saved.attempts > 0 && saved.epoch != epoch) || saved.until > now + COOLDOWN) {
            recordDiagnostic(NotificationRecoveryDiagnostics.Event.STALLED)
            if (!write(State(LIMIT, now + COOLDOWN, epoch))) recordDiagnostic(NotificationRecoveryDiagnostics.Event.STORAGE_FAILURE)
            return@synchronized null
        }
        if (saved.attempts > 0 && now < saved.until) return@synchronized null
        val critical = recoveryState().severity == NotificationRecoveryDiagnostics.Severity.CRITICAL
        val count = if (critical) LIMIT else if (saved.attempts == LIMIT) 1 else saved.attempts + 1
        val delay = if (count == LIMIT) COOLDOWN else delays[count - 1]
        // Reserve before execution so interruption cannot create an unbounded retry loop.
        if (saved.attempts == LIMIT) recordDiagnostic(NotificationRecoveryDiagnostics.Event.STALLED)
        if (!write(State(count, now + delay, epoch))) {
            recordDiagnostic(NotificationRecoveryDiagnostics.Event.STORAGE_FAILURE)
            return@synchronized null
        }
        val result = try { operation() } catch (e: Exception) { PersistentReminderPreviewLedger.Result.STORAGE_FAILURE }
        if (result == PersistentReminderPreviewLedger.Result.STORAGE_FAILURE) {
            recordDiagnostic(NotificationRecoveryDiagnostics.Event.STORAGE_FAILURE)
        } else if (!write(State(0, 0))) {
            recordDiagnostic(NotificationRecoveryDiagnostics.Event.STORAGE_FAILURE)
            return@synchronized null
        } else {
            recordDiagnostic(NotificationRecoveryDiagnostics.Event.RECOVERED)
        }
        result
    }
}

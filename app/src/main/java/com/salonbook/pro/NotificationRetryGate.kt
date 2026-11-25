package com.salonbook.pro

import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline, process-wide serialization. No timers, delivery, or customer identifiers. */
internal class NotificationRetryGate(directory: File) {
    companion object {
        private val lock = Any()
        private val delays = longArrayOf(30_000L, 120_000L, 600_000L)
        private const val LIMIT = 4
        private const val COOLDOWN = 3_600_000L
        private fun hash(s: String) = MessageDigest.getInstance("SHA-256")
            .digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private val file = AtomicFile(File(directory, "notification-retry-v1.state"))
    private data class State(val attempts: Int, val until: Long)
    private fun read(): State? {
        return try {
            val backup = File(file.baseFile.path + ".bak")
            val committed = if (backup.exists()) backup else file.baseFile
            if (!committed.exists()) {
                if (File(file.baseFile.path + ".new").exists()) null else State(0, 0)
            } else if (!committed.isFile || committed.length() > 160) null
            else {
                val parts = file.readFully().toString(Charsets.UTF_8).split("\n")
                val n = parts.getOrNull(1)?.toIntOrNull()
                val until = parts.getOrNull(2)?.toLongOrNull()
                if (parts.size == 4 && parts[0] == "BOUSTIO-RETRY-1" && n != null && n in 0..LIMIT &&
                    until != null && until >= 0 && parts[3] == hash(parts.take(3).joinToString("\n"))) State(n, until) else null
            }
        } catch (e: Exception) { null }
    }
    private fun write(state: State): Boolean {
        val payload = "BOUSTIO-RETRY-1\n${state.attempts}\n${state.until}"
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
    fun attempt(now: Long, operation: () -> PersistentReminderPreviewLedger.Result): PersistentReminderPreviewLedger.Result? = synchronized(lock) {
        if (now < 0 || now > Long.MAX_VALUE - COOLDOWN) return@synchronized null
        val saved = read() ?: return@synchronized null
        if (now < saved.until) return@synchronized null
        val count = if (saved.attempts == LIMIT) 1 else saved.attempts + 1
        val delay = if (count == LIMIT) COOLDOWN else delays[count - 1]
        // Reserve before execution so interruption cannot create an unbounded retry loop.
        if (!write(State(count, now + delay))) return@synchronized null
        val result = try { operation() } catch (e: Exception) { PersistentReminderPreviewLedger.Result.STORAGE_FAILURE }
        if (result != PersistentReminderPreviewLedger.Result.STORAGE_FAILURE) write(State(0, 0))
        result
    }
}

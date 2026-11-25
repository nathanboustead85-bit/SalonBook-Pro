package com.salonbook.pro

import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Identifier-free offline health state. Shared lock protects instances in this process. */
internal class NotificationHealthMonitor(directory: File? = null) {
    enum class State { HEALTHY, DEGRADED, CRITICAL }
    enum class Signal { NONE, DEGRADED, CRITICAL, RECOVERED }
    companion object {
        private val lock = Any()
        private fun digest(s: String) = MessageDigest.getInstance("SHA-256")
            .digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private val file = directory?.let { AtomicFile(File(it, "notification-health-v1.state")) }
    private var failures = 0
    private var unsaved = false
    private fun state(n: Int) = when (n) { 0 -> State.HEALTHY; 3 -> State.CRITICAL; else -> State.DEGRADED }
    private fun load(): Int {
        val f = file ?: return failures
        return try {
            val backup = File(f.baseFile.path + ".bak")
            val pending = File(f.baseFile.path + ".new")
            val committed = if (backup.exists()) backup else f.baseFile
            if (!committed.exists()) {
                if (pending.exists() || f.baseFile.parentFile?.isDirectory != true) 3 else 0
            } else if (!committed.isFile || committed.length() > 128L) 3
            else {
                val parts = f.readFully().toString(Charsets.UTF_8).split("\n")
                val n = parts.getOrNull(1)?.toIntOrNull()
                if (parts.size == 3 && parts[0] == "BOUSTIO-HEALTH-1" && n != null && n in 0..3 &&
                    parts[2] == digest(parts[0] + "\n" + parts[1])) n else 3
            }
        } catch (e: Exception) { 3 }
    }
    private fun save(n: Int): Boolean {
        val f = file ?: return true
        val payload = "BOUSTIO-HEALTH-1\n" + n
        val bytes = (payload + "\n" + digest(payload)).toByteArray(Charsets.UTF_8)
        return try {
            val stream = f.startWrite()
            try {
                stream.write(bytes)
                stream.fd.sync()
                f.finishWrite(stream)
            } catch (e: Exception) {
                f.failWrite(stream)
                return false
            }
            f.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    fun snapshot(): State = synchronized(lock) { state(if (unsaved) 3 else load()) }
    fun record(result: PersistentReminderPreviewLedger.Result): Signal = synchronized(lock) {
        val old = if (unsaved) 3 else load()
        if (result == PersistentReminderPreviewLedger.Result.REJECTED) return@synchronized Signal.NONE
        val next = if (result == PersistentReminderPreviewLedger.Result.CLAIMED) 0 else (old + 1).coerceAtMost(3)
        unsaved = !save(next)
        failures = if (unsaved) 3 else next
        val current = state(failures)
        if (state(old) == current) Signal.NONE else when (current) {
            State.HEALTHY -> Signal.RECOVERED
            State.DEGRADED -> Signal.DEGRADED
            State.CRITICAL -> Signal.CRITICAL
        }
    }
}

package com.salonbook.pro

import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

internal class NotificationRecoveryDiagnostics(directory: File) {
    enum class Event { STORAGE_FAILURE, STALLED, RECOVERED }
    enum class Signal { NONE, WARNING, CRITICAL, RECOVERED }
    enum class Severity { HEALTHY, WARNING, CRITICAL }
    data class Snapshot(val failures: Int, val stalls: Int, val severity: Severity)
    companion object {
        private val lock = Any()
        private const val LIMIT = 100
        private fun digest(s: String) = MessageDigest.getInstance("SHA-256")
            .digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private val file = AtomicFile(File(directory, "notification-recovery-v1.state"))
    private var unsaved = false
    private fun state(f: Int, s: Int) = Snapshot(f, s, when {
        f >= 3 || s >= 3 -> Severity.CRITICAL
        f > 0 || s > 0 -> Severity.WARNING
        else -> Severity.HEALTHY
    })
    private fun read(): Snapshot = try {
        val backup = File(file.baseFile.path + ".bak")
        val committed = if (backup.exists()) backup else file.baseFile
        if (!committed.exists()) {
            if (File(file.baseFile.path + ".new").exists() || file.baseFile.parentFile?.isDirectory != true) state(3, 3) else state(0, 0)
        } else if (!committed.isFile || committed.length() > 128) state(3, 3)
        else {
            val p = file.readFully().toString(Charsets.UTF_8).split("\n")
            val f = p.getOrNull(1)?.toIntOrNull()
            val s = p.getOrNull(2)?.toIntOrNull()
            if (p.size == 4 && p[0] == "BOUSTIO-RECOVERY-1" && f != null && s != null &&
                f in 0..LIMIT && s in 0..LIMIT && p[3] == digest(p.take(3).joinToString("\n"))) state(f,s)
            else state(3,3)
        }
    } catch (e: Exception) { state(3,3) }
    fun snapshot(): Snapshot = synchronized(lock) { if (unsaved) state(3,3) else read() }
    fun record(event: Event): Signal = synchronized(lock) {
        val old = snapshot()
        val next = when(event) {
            Event.STORAGE_FAILURE -> state((old.failures + 1).coerceAtMost(LIMIT), old.stalls)
            Event.STALLED -> state(old.failures, (old.stalls + 1).coerceAtMost(LIMIT))
            Event.RECOVERED -> state(0,0)
        }
        val payload = "BOUSTIO-RECOVERY-1\n${next.failures}\n${next.stalls}"
        val bytes = (payload + "\n" + digest(payload)).toByteArray(Charsets.UTF_8)
        unsaved = try {
            val stream = file.startWrite()
            try {
                stream.write(bytes)
                stream.fd.sync()
                file.finishWrite(stream)
            } catch (e: Exception) {
                file.failWrite(stream)
                throw e
            }
            !file.readFully().contentEquals(bytes)
         } catch (e: Exception) { true }
        val current = if (unsaved) Severity.CRITICAL else next.severity
        if (old.severity == current) Signal.NONE else when (current) {
            Severity.HEALTHY -> Signal.RECOVERED
            Severity.WARNING -> Signal.WARNING
            Severity.CRITICAL -> Signal.CRITICAL
        }
    }
}

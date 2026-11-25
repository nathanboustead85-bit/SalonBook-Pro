package com.salonbook.pro
import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline only; no recipient data or delivery. */
internal class CancellationOutboxPreview(directory: File) {
    enum class Status { PENDING, PROCESSED, EXHAUSTED, UNKNOWN, WAIT, REJECTED }
    private data class Entry(val channel: AppointmentCancellationPreview.Channel, val attempts: Int, val next: Long, val status: Status)
    private val file = AtomicFile(File(directory,"cancellation-outbox-v1.state"))
    companion object {
        private val lock = Any()
        private val hex = Regex("[0-9a-f]{64}")
        private const val LIMIT = 10000
        private fun hash(s: String) = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private fun load(): MutableMap<String,Entry>? {
        return try {
            val base = file.baseFile
            if (base.parentFile?.isDirectory != true) return null
            val backup = File(base.path+".bak")
            val committed = if (backup.exists()) backup else base
            if (!committed.exists()) return if (File(base.path+".new").exists()) null else mutableMapOf()
            if (!committed.isFile || committed.length() > 2000000) return null
            val lines = file.readFully().toString(Charsets.UTF_8).split("\n")
            if (lines.size < 2 || lines.first() != "BOUSTIO-CANCEL-1" || hash(lines.dropLast(1).joinToString("\n")) != lines.last()) return null
            val map = mutableMapOf<String,Entry>()
            for (line in lines.drop(1).dropLast(1)) {
                val p = line.split("|")
                if (p.size != 5 || !hex.matches(p[0]) || map.containsKey(p[0])) return null
                val e = Entry(AppointmentCancellationPreview.Channel.valueOf(p[1]),p[2].toInt(),p[3].toLong(),Status.valueOf(p[4]))
                if (e.attempts !in 0..3 || e.next < 0 || e.status == Status.WAIT || (e.status == Status.PENDING && e.attempts >= 3)) return null
                map[p[0]] = e
            }
            if (map.size > LIMIT) null else map
        } catch (e: Exception) { null }
    }
    private fun save(map: Map<String,Entry>): Boolean {
        val payload = (listOf("BOUSTIO-CANCEL-1")+map.toSortedMap().map { (k,v) -> listOf(k,v.channel.name,v.attempts,v.next,v.status.name).joinToString("|") }).joinToString("\n")
        val bytes = (payload+"\n"+hash(payload)).toByteArray(Charsets.UTF_8)
        return try {
            val stream = file.startWrite()
            try { stream.write(bytes); stream.fd.sync(); file.finishWrite(stream) }
            catch (e: Exception) { file.failWrite(stream); return false }
            file.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    fun enqueue(intents: List<AppointmentCancellationPreview.Intent>): Boolean = synchronized(lock) {
        val map = load() ?: return@synchronized false
        if (intents.size > 2 || intents.map { it.channel }.distinct().size != intents.size || intents.map { it.key }.distinct().size != intents.size) return@synchronized false
        for (intent in intents) {
            if (!hex.matches(intent.key)) return@synchronized false
            val old = map[intent.key]
            if (old != null && old.channel != intent.channel) return@synchronized false
            if (old == null) map[intent.key] = Entry(intent.channel,0,0,Status.PENDING)
        }
        map.size <= LIMIT && save(map)
    }
    fun status(key: String): Status? = synchronized(lock) { load()?.get(key)?.status }
    fun attempt(intent: AppointmentCancellationPreview.Intent, now: Long, simulate: () -> PersistentReminderPreviewLedger.Result): Status = synchronized(lock) {
        if (now <= 0 || now > Long.MAX_VALUE-120000L) return@synchronized Status.UNKNOWN
        val map = load() ?: return@synchronized Status.UNKNOWN
        val old = map[intent.key] ?: return@synchronized Status.REJECTED
        if (old.channel != intent.channel) return@synchronized Status.REJECTED
        if (old.status != Status.PENDING) return@synchronized old.status
        if (now < old.next) return@synchronized Status.WAIT
        val reserved = old.copy(attempts=old.attempts+1,status=Status.UNKNOWN)
        map[intent.key] = reserved
        if (!save(map)) return@synchronized Status.UNKNOWN
        val result = try { simulate() } catch (e: InterruptedException) {
            Thread.currentThread().interrupt(); return@synchronized Status.UNKNOWN
        } catch (e: Exception) { return@synchronized Status.UNKNOWN }
        val final = when(result) {
            PersistentReminderPreviewLedger.Result.CLAIMED -> reserved.copy(status=Status.PROCESSED)
            PersistentReminderPreviewLedger.Result.REJECTED -> reserved.copy(status=Status.REJECTED)
            PersistentReminderPreviewLedger.Result.STORAGE_FAILURE -> if (reserved.attempts >= 3) reserved.copy(status=Status.EXHAUSTED)
                else reserved.copy(status=Status.PENDING,next=now+(if(reserved.attempts==1) 30000L else 120000L))
        }
        map[intent.key] = final
        if (save(map)) final.status else Status.UNKNOWN
    }
}

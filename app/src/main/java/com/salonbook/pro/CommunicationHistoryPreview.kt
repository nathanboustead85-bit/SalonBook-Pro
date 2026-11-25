package com.salonbook.pro
import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline simulated history; no recipient data or message content. */
internal class CommunicationHistoryPreview(directory: File) {
    enum class Status { ACCEPTED, REJECTED, UNAVAILABLE, UNKNOWN }
    data class Entry(val channel: AppointmentCancellationPreview.Channel, val timestamp: Long, val status: Status)
    private val file = AtomicFile(File(directory,"communication-history-v1.state"))
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
            if (lines.size < 2 || lines.first() != "BOUSTIO-COMM-HISTORY-1" || hash(lines.dropLast(1).joinToString("\n")) != lines.last()) return null
            val map = mutableMapOf<String,Entry>()
            for (line in lines.drop(1).dropLast(1)) {
                val p = line.split("|")
                if (p.size != 4 || !hex.matches(p[0]) || map.containsKey(p[0])) return null
                val e = Entry(AppointmentCancellationPreview.Channel.valueOf(p[1]),p[2].toLong(),Status.valueOf(p[3]))
                if (e.timestamp <= 0) return null
                map[p[0]] = e
            }
            if (map.size > LIMIT) null else map
        } catch (e: Exception) { null }
    }
    private fun save(map: Map<String,Entry>): Boolean {
        val payload = (listOf("BOUSTIO-COMM-HISTORY-1")+map.toSortedMap().map { (k,v) -> listOf(k,v.channel.name,v.timestamp,v.status.name).joinToString("|") }).joinToString("\n")
        val bytes = (payload+"\n"+hash(payload)).toByteArray(Charsets.UTF_8)
        return try {
            val stream = file.startWrite()
            try { stream.write(bytes); stream.fd.sync(); file.finishWrite(stream) }
            catch (e: Exception) { file.failWrite(stream); return false }
            file.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    private fun key(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, channel: AppointmentCancellationPreview.Channel): String? {
        if (snapshot == null || !snapshot.booking.canceled || !NotificationPrivacyPolicy.authorized(snapshot.booking,owner,requested)) return null
        val b = snapshot.booking
        return hash(listOf(b.businessId,b.bookingId,b.revision.toString(),"canceled",channel.name).joinToString("") { "${it.length}:$it" })
    }
    enum class Result { RECORDED, DUPLICATE, INVALID, STORAGE_FAILURE }
    fun record(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, channel: AppointmentCancellationPreview.Channel, timestamp: Long, status: Status): Result = synchronized(lock) {
        val k = key(snapshot,owner,requested,channel) ?: return@synchronized Result.INVALID
        if (timestamp <= 0) return@synchronized Result.INVALID
        val map = load() ?: return@synchronized Result.STORAGE_FAILURE
        if (map.containsKey(k)) return@synchronized Result.DUPLICATE
        if (map.size >= LIMIT) return@synchronized Result.STORAGE_FAILURE
        map[k] = Entry(channel,timestamp,status)
        if (save(map)) Result.RECORDED else Result.STORAGE_FAILURE
    }
    fun lookup(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, channel: AppointmentCancellationPreview.Channel): Entry? = synchronized(lock) {
        val k = key(snapshot,owner,requested,channel) ?: return@synchronized null
        load()?.get(k)?.takeIf { it.channel == channel }
    }
}

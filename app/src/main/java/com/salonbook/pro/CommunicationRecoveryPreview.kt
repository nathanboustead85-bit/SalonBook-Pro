package com.salonbook.pro
import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline simulated attempts only; retry only explicit pre-submission failure. */
internal class CommunicationRecoveryPreview(directory: File) {
    enum class Status { PENDING, PROCESSED, EXHAUSTED, UNKNOWN, WAIT, REJECTED }
    private data class Entry(val channel: AppointmentCancellationPreview.Channel, val attempts: Int, val next: Long, val status: Status)
    private val file = AtomicFile(File(directory,"communication-recovery-v1.state"))
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
            if (lines.size < 2 || lines.first() != "BOUSTIO-COMM-RECOVERY-1" || hash(lines.dropLast(1).joinToString("\n")) != lines.last()) return null
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
        val payload = (listOf("BOUSTIO-COMM-RECOVERY-1")+map.toSortedMap().map { (k,v) -> listOf(k,v.channel.name,v.attempts,v.next,v.status.name).joinToString("|") }).joinToString("\n")
        val bytes = (payload+"\n"+hash(payload)).toByteArray(Charsets.UTF_8)
        return try {
            val stream = file.startWrite()
            try { stream.write(bytes); stream.fd.sync(); file.finishWrite(stream) }
            catch (e: Exception) { file.failWrite(stream); return false }
            file.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    enum class Response { ACCEPTED, DEFINITELY_NOT_SUBMITTED, REJECTED, UNKNOWN }
    fun attempt(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?,
                contact: CustomerCommunicationPolicy.Contact?, candidate: CommunicationPreferencesPreview.State?,
                current: CommunicationPreferencesPreview.State?, controls: CommunicationPreferencesPreview.Controls,
                channel: AppointmentCancellationPreview.Channel, now: Long, simulate: () -> Response): Status = synchronized(lock) {
        if (now <= 0 || now > Long.MAX_VALUE-120000L) return@synchronized Status.UNKNOWN
        if (snapshot == null || channel !in CommunicationPreferencesPreview.eligible(snapshot,owner,requested,contact,candidate,current,controls,now)) return@synchronized Status.REJECTED
        val b = snapshot.booking
        val key = hash(listOf(b.businessId,b.bookingId,b.revision.toString(),"canceled",channel.name).joinToString("") { "${it.length}:$it" })
        val map = load() ?: return@synchronized Status.UNKNOWN
        val old = map[key] ?: Entry(channel,0,0,Status.PENDING)
        if (old.channel != channel) return@synchronized Status.REJECTED
        if (old.status != Status.PENDING) return@synchronized old.status
        if (now < old.next) return@synchronized Status.WAIT
        if (!map.containsKey(key) && map.size >= LIMIT) return@synchronized Status.UNKNOWN
        val reserved = old.copy(attempts=old.attempts+1,status=Status.UNKNOWN)
        map[key] = reserved
        if (!save(map)) return@synchronized Status.UNKNOWN
        val result = try { simulate() } catch (e: InterruptedException) {
            Thread.currentThread().interrupt(); return@synchronized Status.UNKNOWN
        } catch (e: Exception) { return@synchronized Status.UNKNOWN }
        val final = when(result) {
            Response.ACCEPTED -> reserved.copy(status=Status.PROCESSED)
            Response.REJECTED -> reserved.copy(status=Status.REJECTED)
            Response.UNKNOWN -> reserved
            Response.DEFINITELY_NOT_SUBMITTED -> if (reserved.attempts >= 3) reserved.copy(status=Status.EXHAUSTED)
                else reserved.copy(status=Status.PENDING,next=now+(if(reserved.attempts==1) 30000L else 120000L))
        }
        map[key] = final
        if (save(map)) final.status else Status.UNKNOWN
    }
}

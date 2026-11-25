package com.salonbook.pro

import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline schedule projection. Optional dedicated atomic storage; no delivery. */
internal class ReminderSchedulePreview(directory: File? = null) {
    data class Event(val id: String, val window: AutomaticReminderPlan.Window)
    private data class Entry(val revision: Long, val fingerprint: String, val events: List<Event>)
    private val entries = mutableMapOf<String, Entry>()
    private val file = directory?.let { AtomicFile(File(it, "reminder-schedule-v1.state")) }
    companion object {
        private val lock = Any()
        private const val LIMIT = 10000
        private fun digest(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
        private fun hash(parts: List<String>) = digest(parts.joinToString("") { "${it.length}:$it" })
        private val hex = Regex("[0-9a-f]{64}")
    }
    private fun load(): MutableMap<String, Entry>? {
        val store = file ?: return entries.toMutableMap()
        return try {
            val base = store.baseFile
            val backup = File(base.path + ".bak")
            val pending = File(base.path + ".new")
            if (!base.exists() && !backup.exists()) {
                if (pending.exists() || base.parentFile?.isDirectory != true) return null
                return mutableMapOf()
            }
            val committed = if (backup.exists()) backup else base
            if (!committed.isFile || committed.length() > 4000000L) return null
            val lines = store.readFully().toString(Charsets.UTF_8).split("\n")
            if (lines.size < 2 || lines.first() != "BOUSTIO-SCHEDULE-1" || digest(lines.dropLast(1).joinToString("\n")) != lines.last()) return null
            val result = mutableMapOf<String, Entry>()
            for (line in lines.drop(1).dropLast(1)) {
                val fields = line.split("|")
                if (fields.size !in 3..5 || !hex.matches(fields[0]) || !hex.matches(fields[2])) return null
                val revision = fields[1].toLong()
                if (revision <= 0 || fields[0] in result || result.size >= LIMIT) return null
                val events = fields.drop(3).map {
                    val v = it.split(",")
                    if (v.size != 3 || !hex.matches(v[0])) return null
                    val type = NotificationPreferences.ReminderType.valueOf(v[1])
                    val due = v[2].toLong()
                    if (type !in listOf(NotificationPreferences.ReminderType.HOURS_24, NotificationPreferences.ReminderType.HOURS_2) || due <= 0) return null
                    Event(v[0], AutomaticReminderPlan.Window(type,due))
                }
                if (events.map { it.window.type }.distinct().size != events.size) return null
                result[fields[0]] = Entry(revision,fields[2],events)
            }
            result
        } catch (e: Exception) { null }
    }
    private fun save(next: MutableMap<String, Entry>): Boolean {
        val store = file
        if (store == null) { entries.clear(); entries.putAll(next); return true }
        return try {
            val payload = (listOf("BOUSTIO-SCHEDULE-1") + next.toSortedMap().map { (key,entry) ->
                (listOf(key,entry.revision.toString(),entry.fingerprint) + entry.events.map { "${it.id},${it.window.type.name},${it.window.dueAtMillis}" }).joinToString("|")
            }).joinToString("\n")
            val bytes = (payload + "\n" + digest(payload)).toByteArray(Charsets.UTF_8)
            val stream = store.startWrite()
            try { stream.write(bytes); stream.fd.sync(); store.finishWrite(stream) }
            catch (e: Exception) { store.failWrite(stream); return false }
            store.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    fun reconcile(candidate: SecureReminderPlan.Snapshot?, current: SecureReminderPlan.Snapshot?, owner: String?, requested: String?, consent: NotificationPreferences.CustomerConsent?, settings: NotificationPreferences.BusinessSettings, now: Long): List<Event> = synchronized(lock) {
        if (current == null || candidate != current || now <= 0L || !NotificationPrivacyPolicy.authorized(current.booking, owner, requested)) return@synchronized emptyList()
        val booking = current.booking
        val key = hash(listOf(booking.businessId,booking.bookingId))
        val fingerprint = hash(listOf(booking.businessId,booking.bookingId,booking.revision.toString(),booking.confirmed.toString(),booking.canceled.toString(),booking.email?.let { "present:$it" } ?: "absent",booking.emailConsent.toString(),booking.businessEmailEnabled.toString(),current.customerId,current.appointmentAtMillis.toString()))
        val next = load() ?: return@synchronized emptyList()
        val previous = next[key]
        if (previous != null && (booking.revision < previous.revision || (booking.revision == previous.revision && fingerprint != previous.fingerprint))) return@synchronized emptyList()
        if (previous == null && next.size >= LIMIT) return@synchronized emptyList()
        val events = SecureReminderPlan.windows(candidate,current,owner,requested,consent,settings,now).map { window ->
            Event(hash(listOf(booking.businessId,booking.bookingId,booking.revision.toString(),current.appointmentAtMillis.toString(),window.type.name)),window)
        }
        next[key] = Entry(booking.revision,fingerprint,events)
        if (save(next)) events.toList() else emptyList()
    }
    fun count(): Int = synchronized(lock) { load()?.values?.sumOf { it.events.size } ?: 0 }
}

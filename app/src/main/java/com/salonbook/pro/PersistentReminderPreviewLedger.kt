package com.salonbook.pro

import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Dedicated offline preview history. Never accesses bookings or sends messages. */
internal class PersistentReminderPreviewLedger(directory: File) {
    private val file = AtomicFile(File(directory, "reminder-preview-v1.history"))
    companion object {
        private val lock = Any()
        private const val LIMIT = 10000
        private fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    fun claim(candidate: NotificationSafetyPolicy.BookingSnapshot?, current: NotificationSafetyPolicy.BookingSnapshot?, owner: String, event: String, eligible: Boolean): Boolean = synchronized(lock) {
        if (!ReminderPreviewLedger().claimPreview(candidate, current, owner, event, eligible) || current == null) return@synchronized false
        try {
            val entries = if (file.baseFile.exists() || File(file.baseFile.path + ".bak").exists()) {
                val backup = File(file.baseFile.path + ".bak")
                val committed = if (backup.exists()) backup else file.baseFile
                if (!committed.isFile || committed.length() > 700000L) return@synchronized false
                val lines = file.readFully().toString(Charsets.UTF_8).split("\n")
                if (lines.size < 2 || lines.first() != "BOUSTIO-PREVIEW-1") return@synchronized false
                val payload = lines.dropLast(1).joinToString("\n")
                if (digest(payload) != lines.last()) return@synchronized false
                val keys = lines.drop(1).dropLast(1)
                if (keys.size > LIMIT || keys.any { !it.matches(Regex("[0-9a-f]{64}")) } || keys.distinct().size != keys.size) return@synchronized false
                // AtomicFile restores the committed copy and discards interrupted replacement writes.
                keys.toMutableSet()
            } else {
                if (File(file.baseFile.path + ".new").exists()) return@synchronized false
                mutableSetOf<String>()
            }
            val key = digest(listOf(current.businessId, current.bookingId, current.revision.toString(), event).joinToString("") { "${it.length}:$it" })
            if (entries.size >= LIMIT || !entries.add(key)) return@synchronized false
            val payload = (listOf("BOUSTIO-PREVIEW-1") + entries.sorted()).joinToString("\n")
            val stream = file.startWrite()
            try {
                stream.write((payload + "\n" + digest(payload)).toByteArray(Charsets.UTF_8))
                stream.fd.sync()
                file.finishWrite(stream)
            } catch (e: Exception) {
                file.failWrite(stream)
                return@synchronized false
            }
            file.readFully().toString(Charsets.UTF_8) == payload + "\n" + digest(payload)
        } catch (e: Exception) { false }
    }
}

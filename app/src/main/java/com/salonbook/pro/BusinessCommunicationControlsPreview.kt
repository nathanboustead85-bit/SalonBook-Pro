package com.salonbook.pro
import android.util.AtomicFile
import java.io.File
import java.security.MessageDigest

/** Offline only. Caller identity must be authenticated by a future backend. */
internal class BusinessCommunicationControlsPreview(private val directory: File) {
    data class State(val revision: Long = 0, val changedAt: Long = 0, val email: Boolean = false,
                     val whatsapp: Boolean = false, val paused: Boolean = false, val emergency: Boolean = false)
    companion object {
        private val lock = Any()
        private fun hash(s: String) = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private fun file(owner: String?, requested: String?): AtomicFile? =
        if (owner.isNullOrBlank() || owner != requested || !directory.isDirectory) null
        else AtomicFile(File(directory,"business-communication-"+hash(owner)+".state"))
    private fun load(file: AtomicFile): State? {
        return try {
            val base = file.baseFile
            val backup = File(base.path+".bak")
            val committed = if (backup.exists()) backup else base
            if (!committed.exists()) return if (File(base.path+".new").exists()) null else State()
            if (!committed.isFile || committed.length() > 1024) return null
            val lines = file.readFully().toString(Charsets.UTF_8).split("\n")
            if (lines.size != 2 || hash(lines[0]) != lines[1]) return null
            val p = lines[0].split("|")
            if (p.size != 7 || p[0] != "BOUSTIO-CONTROLS-1") return null
            val s = State(p[1].toLong(),p[2].toLong(),p[3].toBooleanStrict(),p[4].toBooleanStrict(),p[5].toBooleanStrict(),p[6].toBooleanStrict())
            if (s.revision <= 0 || s.changedAt <= 0) null else s
        } catch (e: Exception) { null }
    }
    fun read(owner: String?, requested: String?): State? = synchronized(lock) { file(owner,requested)?.let { load(it) } }
    fun change(owner: String?, requested: String?, expected: State, email: Boolean, whatsapp: Boolean,
               paused: Boolean, emergency: Boolean, now: Long): Boolean = synchronized(lock) {
        val f = file(owner,requested) ?: return@synchronized false
        val old = load(f) ?: return@synchronized false
        if (old != expected || old.revision == Long.MAX_VALUE || now <= old.changedAt) return@synchronized false
        val payload = listOf("BOUSTIO-CONTROLS-1",old.revision+1,now,email,whatsapp,paused,emergency).joinToString("|")
        val bytes = (payload+"\n"+hash(payload)).toByteArray(Charsets.UTF_8)
        try {
            val stream = f.startWrite()
            try { stream.write(bytes); stream.fd.sync(); f.finishWrite(stream) }
            catch (e: Exception) { f.failWrite(stream); return@synchronized false }
            f.readFully().contentEquals(bytes)
        } catch (e: Exception) { false }
    }
    fun effective(owner: String?, requested: String?): CommunicationPreferencesPreview.Controls = synchronized(lock) {
        val s = read(owner,requested)
        if (s == null || s.paused || s.emergency) CommunicationPreferencesPreview.Controls()
        else CommunicationPreferencesPreview.Controls(s.email,s.whatsapp)
    }
}

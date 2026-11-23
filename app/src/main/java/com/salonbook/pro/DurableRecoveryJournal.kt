package com.salonbook.pro

import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest

/**
 * Phase 54.1 isolated disk-backed recovery journal. NOT wired to the installed app.
 * Caller must supply a private directory. The journal never touches SharedPreferences.
 * It stores synthetic JSON-array snapshots; schema validation is deferred.
 */
internal class DurableRecoveryJournal(
    private val directory: File,
    private val interruptionPoint: (String) -> Unit = {}
) {
    private val active = File(directory, "snapshot.dat")
    private val pending = File(directory, "pending.dat")
    private val original = File(directory, "original.dat")
    private val marker = File(directory, "transaction.marker")
    private val maxBytes = 3_200_000

    private fun digest(data: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(data)
            .joinToString("") { "%02x".format(it) }

    private fun encode(snapshot: RecoveryTransaction.Snapshot): ByteArray {
        val parts = listOf(snapshot.bookings, snapshot.services, snapshot.staff)
        require(parts.all { it.length <= 1_000_000 && it.trim().startsWith("[") && it.trim().endsWith("]") })
        val payload = parts.joinToString("\n") { java.util.Base64.getEncoder().encodeToString(it.toByteArray(Charsets.UTF_8)) }
        val bytes = payload.toByteArray(Charsets.UTF_8)
        require(bytes.size <= maxBytes)
        return (digest(bytes) + "\n" + payload).toByteArray(Charsets.UTF_8)
    }

    private fun decode(file: File): RecoveryTransaction.Snapshot {
        val bytes = file.readBytes()
        require(bytes.size <= maxBytes + 100)
        val text = bytes.toString(Charsets.UTF_8)
        val separator = text.indexOf('\n')
        require(separator == 64)
        val payload = text.substring(separator + 1).toByteArray(Charsets.UTF_8)
        require(digest(payload) == text.substring(0, separator))
        val parts = payload.toString(Charsets.UTF_8).split("\n")
        require(parts.size == 3)
        val values = parts.map { java.util.Base64.getDecoder().decode(it).toString(Charsets.UTF_8) }
        val snapshot = RecoveryTransaction.Snapshot(values[0], values[1], values[2])
        require(encode(snapshot).isNotEmpty())
        return snapshot
    }

    private fun atomicWrite(destination: File, data: ByteArray) {
        directory.mkdirs()
        val temp = File(directory, destination.name + ".tmp")
        temp.outputStream().use { stream ->
            stream.write(data)
            stream.flush()
            (stream as java.io.FileOutputStream).fd.sync()
        }
        try {
            Files.move(temp.toPath(), destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (error: java.nio.file.AtomicMoveNotSupportedException) {
            // Fail closed rather than silently downgrade to a non-atomic replacement.
            temp.delete()
            throw error
        }
    }

    /** Recover an interrupted transaction before any new operation. */
    @Synchronized fun recover(): Boolean {
        if (!marker.exists()) return !pending.exists() && !original.exists()
        if (!original.exists()) return false
        return try {
            val safe = decode(original)
            atomicWrite(active, encode(safe))
            if (decode(active) != safe) return false
            // Keep original until after the marker is removed; an interrupted
            // cleanup fails closed rather than losing the rollback copy.
            if (pending.exists() && !pending.delete()) return false
            if (!marker.delete()) return false
            if (!original.delete()) return false
            !marker.exists() && !original.exists()
        } catch (_: Exception) { false }
    }

    @Synchronized fun initializeSynthetic(snapshot: RecoveryTransaction.Snapshot): Boolean {
        if (active.exists() || marker.exists() || original.exists() || pending.exists()) return false
        return try { atomicWrite(active, encode(snapshot)); decode(active) == snapshot }
        catch (_: Exception) { false }
    }

    @Synchronized fun readSynthetic(): RecoveryTransaction.Snapshot? =
        try { if (marker.exists() || pending.exists() || original.exists()) null else decode(active) }
        catch (_: Exception) { null }

    @Synchronized fun applySynthetic(incoming: RecoveryTransaction.Snapshot): Boolean {
        if (!recover()) return false
        val before = readSynthetic() ?: return false
        return try {
            val incomingBytes = encode(incoming)
            atomicWrite(original, encode(before))
            interruptionPoint("after-original")
            atomicWrite(marker, "pending".toByteArray(Charsets.UTF_8))
            interruptionPoint("after-marker")
            atomicWrite(pending, incomingBytes)
            interruptionPoint("after-pending")
            require(decode(pending) == incoming)
            atomicWrite(active, incomingBytes)
            interruptionPoint("after-active")
            require(decode(active) == incoming)
            // Cleanup failures leave a marker for safe rollback at next startup.
            require(pending.delete())
            interruptionPoint("after-pending-cleanup")
            require(marker.delete())
            interruptionPoint("after-marker-cleanup")
            require(original.delete())
            true
        } catch (_: Exception) {
            recover()
            false
        }
    }
}

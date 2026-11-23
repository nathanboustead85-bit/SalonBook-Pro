package com.salonbook.pro

import java.security.MessageDigest

/**
 * Phase 56.1: offline-only prototype. The caller must provide a coordinator
 * that excludes ALL writers. This class does not acquire a process/file lock,
 * read Android preferences, persist revisions, or commit data.
 */
internal class VersionedSnapshotProtocol(private val reader: RevisionReader) {
    interface RevisionReader {
        fun readRevision(): Long?
        fun readPayload(): RecoveryTransaction.Snapshot?
    }

    data class Envelope(
        val revision: Long,
        val snapshot: RecoveryTransaction.Snapshot,
        val sha256: String
    )

    sealed class Result {
        data class Accepted(val envelope: Envelope) : Result()
        data class Rejected(val reason: String) : Result()
    }

    fun capture(): Result {
        val before = try { reader.readRevision() } catch (_: Exception) { null }
            ?: return Result.Rejected("Revision unavailable")
        if (before < 0 || before == Long.MAX_VALUE) return Result.Rejected("Revision out of range")
        val snapshot = try { reader.readPayload() } catch (_: Exception) { null }
            ?: return Result.Rejected("Payload unavailable")
        val after = try { reader.readRevision() } catch (_: Exception) { null }
            ?: return Result.Rejected("Revision unavailable after read")
        if (before != after) return Result.Rejected("Revision changed during capture")
        if (snapshot.bookings.toByteArray(Charsets.UTF_8).size > 1_000_000 ||
            snapshot.services.toByteArray(Charsets.UTF_8).size > 1_000_000 ||
            snapshot.staff.toByteArray(Charsets.UTF_8).size > 1_000_000) {
            return Result.Rejected("Payload too large")
        }
        return Result.Accepted(Envelope(before, snapshot, digest(snapshot)))
    }

    companion object {
        /** Length-prefixing avoids ambiguous field boundaries. */
        fun digest(snapshot: RecoveryTransaction.Snapshot): String {
            val bytes = listOf(snapshot.bookings, snapshot.services, snapshot.staff)
                .map { it.toByteArray(Charsets.UTF_8) }
            val md = MessageDigest.getInstance("SHA-256")
            for (part in bytes) {
                md.update(java.nio.ByteBuffer.allocate(4).putInt(part.size).array())
                md.update(part)
            }
            return md.digest().joinToString("") { "%02x".format(it) }
        }
    }
}

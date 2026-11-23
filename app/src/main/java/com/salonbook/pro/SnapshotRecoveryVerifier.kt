package com.salonbook.pro

/**
 * Phase 56.2: pure, read-only offline verification. No restore, persistence,
 * cloud access, or Android integration. A verified result is NOT permission to write.
 */
internal object SnapshotRecoveryVerifier {
    sealed class Verdict {
        data class Verified(val snapshot: RecoveryTransaction.Snapshot, val revision: Long) : Verdict()
        data class Rejected(val reason: String) : Verdict()
    }

    fun verify(
        envelope: VersionedSnapshotProtocol.Envelope?,
        currentRevision: Long?,
        expectedRevision: Long?
    ): Verdict {
        if (envelope == null) return Verdict.Rejected("Missing envelope")
        if (currentRevision == null || expectedRevision == null ||
            currentRevision < 0 || expectedRevision < 0 ||
            currentRevision == Long.MAX_VALUE || expectedRevision == Long.MAX_VALUE)
            return Verdict.Rejected("Invalid revision")
        if (envelope.revision != expectedRevision || currentRevision != expectedRevision)
            return Verdict.Rejected("Stale or conflicting revision")
        val snapshot = envelope.snapshot
        val fields = listOf(snapshot.bookings, snapshot.services, snapshot.staff)
        if (fields.any { it.toByteArray(Charsets.UTF_8).size > 1_000_000 })
            return Verdict.Rejected("Oversized snapshot")
        if (!Regex("^[a-f0-9]{64}$").matches(envelope.sha256))
            return Verdict.Rejected("Invalid digest format")
        val computed = VersionedSnapshotProtocol.digest(snapshot)
        if (!java.security.MessageDigest.isEqual(
                computed.toByteArray(Charsets.US_ASCII),
                envelope.sha256.toByteArray(Charsets.US_ASCII)))
            return Verdict.Rejected("Snapshot integrity mismatch")
        return Verdict.Verified(snapshot, envelope.revision)
    }
}

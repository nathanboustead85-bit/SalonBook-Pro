package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

class SnapshotRecoveryVerifierTest {
    private val synthetic = RecoveryTransaction.Snapshot(
        "[{\\"id\\":\\"synthetic-1\\"},{\\"id\\":\\"synthetic-2\\"}]", "[]", "[]")
    private fun envelope(revision: Long = 9L) =
        VersionedSnapshotProtocol.Envelope(revision, synthetic, VersionedSnapshotProtocol.digest(synthetic))
    private fun rejected(value: SnapshotRecoveryVerifier.Verdict) =
        assertTrue(value is SnapshotRecoveryVerifier.Verdict.Rejected)

    @Test fun verifiedSnapshotKeepsTwoSyntheticAppointments() {
        val result = SnapshotRecoveryVerifier.verify(envelope(), 9L, 9L)
        assertTrue(result is SnapshotRecoveryVerifier.Verdict.Verified)
        assertEquals(synthetic, (result as SnapshotRecoveryVerifier.Verdict.Verified).snapshot)
    }

    @Test fun staleAndConcurrentRevisionsFailClosed() {
        rejected(SnapshotRecoveryVerifier.verify(envelope(), 10L, 9L))
        rejected(SnapshotRecoveryVerifier.verify(envelope(), 9L, 8L))
        rejected(SnapshotRecoveryVerifier.verify(envelope(), null, 9L))
        rejected(SnapshotRecoveryVerifier.verify(envelope(), 9L, Long.MAX_VALUE))
    }

    @Test fun corruptionAndMissingEnvelopeFailClosed() {
        rejected(SnapshotRecoveryVerifier.verify(null, 9L, 9L))
        rejected(SnapshotRecoveryVerifier.verify(envelope().copy(sha256 = "bad"), 9L, 9L))
        rejected(SnapshotRecoveryVerifier.verify(envelope().copy(
            snapshot = synthetic.copy(bookings = "[]")), 9L, 9L))
    }

    @Test fun oversizeFailsClosed() {
        rejected(SnapshotRecoveryVerifier.verify(envelope().copy(
            snapshot = synthetic.copy(staff = "x".repeat(1_000_001))), 9L, 9L))
    }
}

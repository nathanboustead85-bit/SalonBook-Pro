package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

/** Cross-phase synthetic audit. Does not access device, Firebase or production data. */
class RecoveryIntegrityAuditTest {
    private val original = RecoveryTransaction.Snapshot(
        """[{"id":"synthetic-original-1"},{"id":"synthetic-original-2"}]""", "[]", "[]")
    private val incoming = RecoveryTransaction.Snapshot(
        """[{"id":"synthetic-incoming"}]""", "[]", "[]")
    private val envelope = VersionedSnapshotProtocol.Envelope(
        17L, incoming, VersionedSnapshotProtocol.digest(incoming))

    @Test fun captureAndVerifyUseSameDigestAndRevision() {
        val reader = object : VersionedSnapshotProtocol.RevisionReader {
            override fun readRevision(): Long? = 17L
            override fun readPayload(): RecoveryTransaction.Snapshot? = incoming
        }
        val captured = VersionedSnapshotProtocol(reader).capture()
        assertTrue(captured is VersionedSnapshotProtocol.Result.Accepted)
        val accepted = (captured as VersionedSnapshotProtocol.Result.Accepted).envelope
        assertEquals(envelope, accepted)
        assertTrue(SnapshotRecoveryVerifier.verify(accepted, 17L, 17L)
            is SnapshotRecoveryVerifier.Verdict.Verified)
    }

    @Test fun revisionChangeDuringCaptureFailsClosed() {
        var reads = 0
        val reader = object : VersionedSnapshotProtocol.RevisionReader {
            override fun readRevision(): Long? = if (++reads == 1) 17L else 18L
            override fun readPayload(): RecoveryTransaction.Snapshot? = incoming
        }
        assertTrue(VersionedSnapshotProtocol(reader).capture()
            is VersionedSnapshotProtocol.Result.Rejected)
    }

    @Test fun digestTamperingAndStaleRevisionNeverPrepare() {
        val guard = RecoveryConcurrencyGuard()
        assertTrue(guard.begin("stale", envelope, 18L, 17L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertTrue(guard.begin("tampered", envelope.copy(
            snapshot = incoming.copy(bookings = "[]")), 17L, 17L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
    }

    @Test fun failedFinalizeMustAbortBeforeRetry() {
        val guard = RecoveryConcurrencyGuard()
        val prepared = guard.begin("first", envelope, 17L, 17L)
            as RecoveryConcurrencyGuard.Decision.Prepared
        assertFalse(guard.finish(prepared.ticket, 18L))
        assertTrue(guard.begin("second", envelope, 17L, 17L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertTrue(guard.abort(prepared.ticket))
        assertTrue(guard.begin("second", envelope, 17L, 17L)
            is RecoveryConcurrencyGuard.Decision.Prepared)
    }

    @Test fun everyCrashPointAndSuccessPreserveSyntheticOriginal() {
        val simulator = RecoveryCrashSimulator(original)
        for (point in RecoveryCrashSimulator.FailurePoint.values()) {
            val result = simulator.run(point, envelope, 17L)
            assertEquals(original, (result as RecoveryCrashSimulator.Outcome.Aborted).unchanged)
        }
        val success = simulator.run(null, envelope, 17L)
        assertEquals(original, (success as RecoveryCrashSimulator.Outcome.SimulatedSuccess).unchanged)
    }
}

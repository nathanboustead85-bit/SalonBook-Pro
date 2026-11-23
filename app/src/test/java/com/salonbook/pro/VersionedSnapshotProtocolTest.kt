package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

class VersionedSnapshotProtocolTest {
    private val original = RecoveryTransaction.Snapshot(
        "[{\"id\":\"synthetic-1\"},{\"id\":\"synthetic-2\"}]", "[]", "[]"
    )
    private fun capture(revisions: List<Long?>, payload: RecoveryTransaction.Snapshot? = original):
        VersionedSnapshotProtocol.Result {
        var reads = 0
        return VersionedSnapshotProtocol(object : VersionedSnapshotProtocol.RevisionReader {
            override fun readRevision(): Long? = revisions.getOrNull(reads++)
            override fun readPayload(): RecoveryTransaction.Snapshot? = payload
        }).capture()
    }

    @Test fun stableRevisionPreservesTwoSyntheticBookings() {
        val result = capture(listOf(7L, 7L))
        assertTrue(result is VersionedSnapshotProtocol.Result.Accepted)
        val envelope = (result as VersionedSnapshotProtocol.Result.Accepted).envelope
        assertEquals(7L, envelope.revision)
        assertEquals(original, envelope.snapshot)
        assertEquals(64, envelope.sha256.length)
    }

    @Test fun changingRevisionFailsClosed() {
        assertTrue(capture(listOf(7L, 8L)) is VersionedSnapshotProtocol.Result.Rejected)
    }

    @Test fun missingOrInvalidRevisionFailsClosed() {
        for (pair in listOf(listOf(null, 1L), listOf(1L, null), listOf(-1L, -1L),
            listOf(Long.MAX_VALUE, Long.MAX_VALUE))) {
            assertTrue(capture(pair) is VersionedSnapshotProtocol.Result.Rejected)
        }
    }

    @Test fun missingPayloadFailsClosed() {
        assertTrue(capture(listOf(1L, 1L), null) is VersionedSnapshotProtocol.Result.Rejected)
    }

    @Test fun payloadBoundariesAreUnambiguous() {
        val a = RecoveryTransaction.Snapshot("ab", "c", "")
        val b = RecoveryTransaction.Snapshot("a", "bc", "")
        assertNotEquals(VersionedSnapshotProtocol.digest(a), VersionedSnapshotProtocol.digest(b))
        assertEquals(VersionedSnapshotProtocol.digest(original), VersionedSnapshotProtocol.digest(original))
    }

    @Test fun oversizedPayloadFailsClosed() {
        val oversized = original.copy(staff = "x".repeat(1_000_001))
        assertTrue(capture(listOf(1L, 1L), oversized) is VersionedSnapshotProtocol.Result.Rejected)
    }

    @Test fun revisionReaderExceptionFailsClosed() {
        val result = VersionedSnapshotProtocol(object : VersionedSnapshotProtocol.RevisionReader {
            override fun readRevision(): Long? = throw IllegalStateException("synthetic fault")
            override fun readPayload(): RecoveryTransaction.Snapshot? = original
        }).capture()
        assertTrue(result is VersionedSnapshotProtocol.Result.Rejected)
    }
}

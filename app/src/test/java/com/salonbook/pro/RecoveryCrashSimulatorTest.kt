package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

class RecoveryCrashSimulatorTest {
    private val original = RecoveryTransaction.Snapshot(
        """[{"id":"synthetic-original-1"},{"id":"synthetic-original-2"}]""", "[]", "[]")
    private val incoming = RecoveryTransaction.Snapshot(
        """[{"id":"synthetic-incoming"}]""", "[]", "[]")
    private val envelope = VersionedSnapshotProtocol.Envelope(
        7L, incoming, VersionedSnapshotProtocol.digest(incoming))

    @Test fun everyCrashPointLeavesOriginalUntouched() {
        for (point in RecoveryCrashSimulator.FailurePoint.values()) {
            val result = RecoveryCrashSimulator(original).run(point, envelope, 7L)
            assertTrue(result is RecoveryCrashSimulator.Outcome.Aborted)
            assertEquals(original, (result as RecoveryCrashSimulator.Outcome.Aborted).unchanged)
        }
    }

    @Test fun repeatedFailuresNeverInstallIncomingData() {
        val simulator = RecoveryCrashSimulator(original)
        repeat(100) {
            val result = simulator.run(RecoveryCrashSimulator.FailurePoint.DURING_STAGING, envelope, 7L)
            assertEquals(original, (result as RecoveryCrashSimulator.Outcome.Aborted).unchanged)
        }
    }

    @Test fun successfulSimulationIsStillReadOnly() {
        val result = RecoveryCrashSimulator(original).run(null, envelope, 7L)
        assertTrue(result is RecoveryCrashSimulator.Outcome.SimulatedSuccess)
        assertEquals(original, (result as RecoveryCrashSimulator.Outcome.SimulatedSuccess).unchanged)
    }

    @Test fun corruptSnapshotFailsClosedWithoutMutation() {
        val corrupt = envelope.copy(sha256 = "invalid")
        val result = RecoveryCrashSimulator(original).run(null, corrupt, 7L)
        assertTrue(result is RecoveryCrashSimulator.Outcome.Aborted)
        assertEquals(original, (result as RecoveryCrashSimulator.Outcome.Aborted).unchanged)
    }
}

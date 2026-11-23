package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

class DurableRecoveryJournalTest {
    private val empty = RecoveryTransaction.Snapshot("[]", "[]", "[]")
    private val updated = RecoveryTransaction.Snapshot("[{\"id\":\"synthetic\"}]", "[]", "[]")

    private fun withDirectory(block: (File) -> Unit) {
        val dir = Files.createTempDirectory("boustio-synthetic-").toFile()
        try { block(dir) } finally { dir.deleteRecursively() }
    }

    @Test fun persistsAcrossNewInstances() = withDirectory { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(empty))
        assertTrue(DurableRecoveryJournal(dir).applySynthetic(updated))
        assertEquals(updated, DurableRecoveryJournal(dir).readSynthetic())
    }

    @Test fun refusesToOverwriteExistingSnapshotOnInitialization() = withDirectory { dir ->
        val journal = DurableRecoveryJournal(dir)
        assertTrue(journal.initializeSynthetic(empty))
        assertFalse(journal.initializeSynthetic(updated))
        assertEquals(empty, journal.readSynthetic())
    }

    @Test fun refusesCorruptSnapshot() = withDirectory { dir ->
        val journal = DurableRecoveryJournal(dir)
        assertTrue(journal.initializeSynthetic(empty))
        File(dir, "snapshot.dat").writeText("corrupt")
        assertNull(DurableRecoveryJournal(dir).readSynthetic())
        assertFalse(DurableRecoveryJournal(dir).applySynthetic(updated))
    }

    @Test fun refusesUnexpectedInterruptedArtifacts() = withDirectory { dir ->
        val journal = DurableRecoveryJournal(dir)
        assertTrue(journal.initializeSynthetic(empty))
        File(dir, "pending.dat").writeText("incomplete")
        assertNull(DurableRecoveryJournal(dir).readSynthetic())
        assertFalse(DurableRecoveryJournal(dir).applySynthetic(updated))
    }

    @Test fun rejectsInvalidInputWithoutChangingOriginal() = withDirectory { dir ->
        val journal = DurableRecoveryJournal(dir)
        assertTrue(journal.initializeSynthetic(empty))
        assertFalse(journal.applySynthetic(updated.copy(bookings="invalid")))
        assertEquals(empty, DurableRecoveryJournal(dir).readSynthetic())
    }
    /** Error simulates a process disappearing: applySynthetic catches Exception, not Error. */
    private class SimulatedProcessDeath : Error("synthetic process termination")

    @Test fun crashAfterMarkerPendingOrActiveRollsBackOnRestart() {
        for (point in listOf("after-marker", "after-pending", "after-active", "after-pending-cleanup")) {
            withDirectory { dir ->
                assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(empty))
                val interrupted = DurableRecoveryJournal(dir) { checkpoint ->
                    if (checkpoint == point) throw SimulatedProcessDeath()
                }
                try {
                    interrupted.applySynthetic(updated)
                    fail("Expected synthetic crash at $point")
                } catch (_: SimulatedProcessDeath) { }
                val restarted = DurableRecoveryJournal(dir)
                assertNull("Must not read while transaction is incomplete: $point", restarted.readSynthetic())
                assertTrue("Recovery failed at $point", restarted.recover())
                assertEquals("Original data not restored at $point", empty, restarted.readSynthetic())
                assertTrue("Recovery must be idempotent", restarted.recover())
            }
        }
    }

    @Test fun crashBeforeMarkerRestoresOriginalOnRestart() = withDirectory { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(empty))
        try {
            DurableRecoveryJournal(dir) { checkpoint ->
                if (checkpoint == "after-original") throw SimulatedProcessDeath()
            }.applySynthetic(updated)
            fail("Expected synthetic crash")
        } catch (_: SimulatedProcessDeath) { }
        val restarted = DurableRecoveryJournal(dir)
        assertTrue(restarted.recover())
        assertEquals(empty, restarted.readSynthetic())
        assertFalse(File(dir, "original.dat").exists())
    }

    @Test fun crashAfterMarkerCleanupRestoresOriginalOnRestart() = withDirectory { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(empty))
        try {
            DurableRecoveryJournal(dir) { checkpoint ->
                if (checkpoint == "after-marker-cleanup") throw SimulatedProcessDeath()
            }.applySynthetic(updated)
            fail("Expected synthetic crash")
        } catch (_: SimulatedProcessDeath) { }
        val restarted = DurableRecoveryJournal(dir)
        assertTrue(restarted.recover())
        assertEquals(empty, restarted.readSynthetic())
        assertFalse(File(dir, "original.dat").exists())
    }

}

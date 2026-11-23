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
}

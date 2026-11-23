package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** Phase 54.4 isolated synthetic-data regression tests. No Android or Firebase access. */
class DurableRecoveryJournalFinalAuditTest {
    private val original = RecoveryTransaction.Snapshot(
        "[{\"id\":\"synthetic-original-1\"},{\"id\":\"synthetic-original-2\"}]",
        "[{\"name\":\"Haircut\"}]", "[{\"name\":\"Alex\"}]"
    )

    private fun sandbox(test: (File) -> Unit) {
        val dir = Files.createTempDirectory("boustio-54-4-synthetic-").toFile()
        try { test(dir) } finally { dir.deleteRecursively() }
    }

    @Test fun twoSyntheticAppointmentsSurviveCrashAtEveryCheckpoint() {
        val checkpoints = listOf(
            "after-original", "after-marker", "after-pending", "after-active",
            "after-pending-cleanup", "after-marker-cleanup"
        )
        for (point in checkpoints) sandbox { dir ->
            assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(original))
            try {
                DurableRecoveryJournal(dir) { stage ->
                    if (stage == point) throw SyntheticTermination()
                }.applySynthetic(RecoveryTransaction.Snapshot("[]", "[]", "[]"))
                fail("Crash injection was not reached: $point")
            } catch (_: SyntheticTermination) { }
            val restarted = DurableRecoveryJournal(dir)
            assertNull("Unsafe read at $point", restarted.readSynthetic())
            assertTrue("Rollback at $point", restarted.recover())
            assertEquals("Original synthetic records at $point", original, restarted.readSynthetic())
        }
    }

    private class SyntheticTermination : Error("Synthetic process termination")

    @Test fun repeatedSuccessfulUpdatesPersistAcrossNewJournalInstances() = sandbox { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(original))
        var expected = original
        for (i in 1..20) {
            expected = original.copy(bookings = "[{\"id\":\"synthetic-$i\"}]")
            assertTrue("Update $i", DurableRecoveryJournal(dir).applySynthetic(expected))
            assertEquals("Restart $i", expected, DurableRecoveryJournal(dir).readSynthetic())
        }
    }

    @Test fun unicodeAndLineBreaksRoundTripWithoutTruncation() = sandbox { dir ->
        val unicode = original.copy(
            bookings = "[{\"client\":\"José 🪮 東京\",\"notes\":\"first\\nsecond\"}]",
            services = "[{\"name\":\"Coupe française £20\"}]"
        )
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(unicode))
        assertEquals(unicode, DurableRecoveryJournal(dir).readSynthetic())
    }

    @Test fun oversizedPayloadIsRejectedWithoutChangingOriginal() = sandbox { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(original))
        val oversized = original.copy(bookings = "[" + "x".repeat(1_000_001) + "]")
        assertFalse(DurableRecoveryJournal(dir).applySynthetic(oversized))
        assertEquals(original, DurableRecoveryJournal(dir).readSynthetic())
    }

    @Test fun corruptedOriginalNeverSilentlyReplacesActive() = sandbox { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(original))
        File(dir, "original.dat").writeText("bad checksum")
        val journal = DurableRecoveryJournal(dir)
        assertFalse(journal.recover())
        assertNull(journal.readSynthetic())
        assertTrue(File(dir, "original.dat").exists())
        assertTrue(File(dir, "snapshot.dat").exists())
    }

    @Test fun unknownPendingWithoutOriginalRemainsBlocked() = sandbox { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(original))
        File(dir, "pending.dat").writeText("unknown transaction")
        val journal = DurableRecoveryJournal(dir)
        assertFalse(journal.recover())
        assertNull(journal.readSynthetic())
        assertFalse(journal.applySynthetic(original.copy(bookings = "[]")))
    }

    @Test fun invalidPayloadNeverBeginsTransaction() = sandbox { dir ->
        assertTrue(DurableRecoveryJournal(dir).initializeSynthetic(original))
        assertFalse(DurableRecoveryJournal(dir).applySynthetic(original.copy(staff = "not-an-array")))
        assertEquals(original, DurableRecoveryJournal(dir).readSynthetic())
        assertFalse(File(dir, "original.dat").exists())
        assertFalse(File(dir, "transaction.marker").exists())
    }
}

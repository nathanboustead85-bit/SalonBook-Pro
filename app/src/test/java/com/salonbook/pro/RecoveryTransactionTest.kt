package com.salonbook.pro

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RecoveryTransactionTest {
    private val original = RecoveryTransaction.Snapshot("[]", "[]", "[]")
    private val incoming = RecoveryTransaction.Snapshot("[{\"id\":\"synthetic\"}]", "[]", "[]")

    private class FakeStore(
        var value: RecoveryTransaction.Snapshot,
        var corruptNextWrite: Boolean = false,
        var throwNextWrite: Boolean = false,
        var failRollback: Boolean = false
    ) : RecoveryTransaction.RecoveryStore {
        var writes = 0
        override fun read(): RecoveryTransaction.Snapshot = value
        override fun write(snapshot: RecoveryTransaction.Snapshot) {
            writes++
            if (throwNextWrite) {
                throwNextWrite = false
                throw IllegalStateException("synthetic write interruption")
            }
            if (failRollback && writes > 1) throw IllegalStateException("rollback unavailable")
            value = if (corruptNextWrite) {
                corruptNextWrite = false
                snapshot.copy(bookings = "corrupt")
            } else snapshot
        }
    }

    private val validate: (RecoveryTransaction.Snapshot) -> Boolean = {
        listOf(it.bookings, it.services, it.staff).all { payload ->
            payload.startsWith("[") && payload.endsWith("]")
        }
    }

    @Test fun successAppliesSyntheticSnapshot() {
        val store = FakeStore(original)
        assertTrue(RecoveryTransaction(store).applySynthetic(incoming, validate) is RecoveryTransaction.Outcome.Applied)
        assertEquals(incoming, store.value)
    }

    @Test fun interruptedWriteRollsBackOriginal() {
        val store = FakeStore(original, throwNextWrite = true)
        assertTrue(RecoveryTransaction(store).applySynthetic(incoming, validate) is RecoveryTransaction.Outcome.RolledBack)
        assertEquals(original, store.value)
    }

    @Test fun corruptedWriteRollsBackOriginal() {
        val store = FakeStore(original, corruptNextWrite = true)
        assertTrue(RecoveryTransaction(store).applySynthetic(incoming, validate) is RecoveryTransaction.Outcome.RolledBack)
        assertEquals(original, store.value)
    }

    @Test fun rollbackFailureIsReportedNotClaimedSuccessful() {
        val store = FakeStore(original, corruptNextWrite = true, failRollback = true)
        assertTrue(RecoveryTransaction(store).applySynthetic(incoming, validate) is RecoveryTransaction.Outcome.RecoveryFailed)
    }

    @Test fun invalidSnapshotNeverWrites() {
        val store = FakeStore(original)
        val invalid = incoming.copy(bookings = "invalid")
        assertTrue(RecoveryTransaction(store).applySynthetic(invalid, validate) is RecoveryTransaction.Outcome.RecoveryFailed)
        assertEquals(0, store.writes)
        assertEquals(original, store.value)
    }
}

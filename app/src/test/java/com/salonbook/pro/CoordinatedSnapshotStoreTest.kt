package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class CoordinatedSnapshotStoreTest {
    private val initial = RecoveryTransaction.Snapshot(
        "[{\"id\":\"synthetic-1\"},{\"id\":\"synthetic-2\"}]", "[]", "[]"
    )

    @Test fun successfulUpdateIncrementsRevisionAndKeepsBookings() {
        val store = CoordinatedSnapshotStore(initial)
        val result = store.update(0) { it.copy(services = "[{\"name\":\"Cut\"}]") }
        assertTrue(result is CoordinatedSnapshotStore.Update.Applied)
        assertEquals(1L, store.read().revision)
        assertEquals(initial.bookings, store.read().snapshot.bookings)
    }

    @Test fun staleRevisionDoesNotOverwriteWinner() {
        val store = CoordinatedSnapshotStore(initial)
        assertTrue(store.update(0) { it.copy(staff = "[{\"name\":\"A\"}]") is CoordinatedSnapshotStore.Update.Applied)
        assertTrue(store.update(0) { it.copy(staff = "[{\"name\":\"B\"}]") is CoordinatedSnapshotStore.Update.Rejected)
        assertEquals("[{\"name\":\"A\"}]", store.read().snapshot.staff)
    }

    @Test fun interruptedTransformLeavesOriginalUnchanged() {
        val store = CoordinatedSnapshotStore(initial)
        val before = store.read()
        assertTrue(store.update(0) { throw IllegalStateException("synthetic interruption") } is CoordinatedSnapshotStore.Update.Rejected)
        assertEquals(before, store.read())
    }

    @Test fun oversizedUpdateFailsWithoutMutation() {
        val store = CoordinatedSnapshotStore(initial)
        val before = store.read()
        assertTrue(store.update(0) { it.copy(services = "x".repeat(1_000_001)) } is CoordinatedSnapshotStore.Update.Rejected)
        assertEquals(before, store.read())
    }

    @Test fun revisionExhaustionFailsClosed() {
        val store = CoordinatedSnapshotStore(initial, Long.MAX_VALUE - 1)
        assertTrue(store.update(Long.MAX_VALUE - 1) { it.copy(staff = "[]") } is CoordinatedSnapshotStore.Update.Rejected)
        assertEquals(Long.MAX_VALUE - 1, store.read().revision)
    }

    @Test fun simultaneousUpdatesYieldExactlyOneWinner() {
        val store = CoordinatedSnapshotStore(initial)
        val workers = 12
        val start = CountDownLatch(1)
        val ready = CountDownLatch(workers)
        val executor = Executors.newFixedThreadPool(workers)
        try {
            val futures = (1..workers).map { n ->
                executor.submit<Boolean> {
                    ready.countDown()
                    check(start.await(5, TimeUnit.SECONDS))
                    store.update(0) { it.copy(staff = "[{\"name\":\"$n\"}]") } is CoordinatedSnapshotStore.Update.Applied
                }
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS))
            start.countDown()
            assertEquals(1, futures.count { it.get(10, TimeUnit.SECONDS) })
            assertEquals(1L, store.read().revision)
            assertEquals(initial.bookings, store.read().snapshot.bookings)
        } finally {
            start.countDown()
            executor.shutdownNow()
        }
    }

    @Test fun repeatedReadIsConsistent() {
        val store = CoordinatedSnapshotStore(initial)
        repeat(100) {
            val state = store.read()
            assertEquals(VersionedSnapshotProtocol.digest(state.snapshot), state.sha256)
        }
    }
}

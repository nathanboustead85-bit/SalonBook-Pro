package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class RecoveryConcurrencyGuardTest {
    private val synthetic = RecoveryTransaction.Snapshot(
        """[{"id":"synthetic-1"},{"id":"synthetic-2"}]""", "[]", "[]")
    private val envelope = VersionedSnapshotProtocol.Envelope(
        12L, synthetic, VersionedSnapshotProtocol.digest(synthetic))
    private fun prepared(result: RecoveryConcurrencyGuard.Decision) =
        result as RecoveryConcurrencyGuard.Decision.Prepared

    @Test fun interruptedRecoveryCanAbortAndRetryWithoutWriting() {
        val guard = RecoveryConcurrencyGuard()
        val first = prepared(guard.begin("request-1", envelope, 12L, 12L))
        assertTrue(guard.abort(first.ticket))
        assertFalse(guard.abort(first.ticket))
        assertTrue(guard.begin("request-1", envelope, 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Prepared)
    }

    @Test fun concurrentAndDuplicateAttemptsFailClosed() {
        val guard = RecoveryConcurrencyGuard()
        val first = prepared(guard.begin("request-1", envelope, 12L, 12L))
        assertTrue(guard.begin("request-2", envelope, 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertFalse(guard.finish(first.ticket, 13L))
        assertTrue(guard.begin("request-2", envelope, 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertTrue(guard.finish(first.ticket, 12L))
        assertTrue(guard.begin("request-1", envelope, 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertTrue(guard.begin("request-2", envelope, 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Prepared)
    }

    @Test fun staleAndCorruptPlansAreRejected() {
        val guard = RecoveryConcurrencyGuard()
        assertTrue(guard.begin("stale", envelope, 13L, 12L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertTrue(guard.begin("corrupt", envelope.copy(sha256 = "bad"), 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
        assertTrue(guard.begin("", envelope, 12L, 12L)
            is RecoveryConcurrencyGuard.Decision.Rejected)
    }

    @Test fun simultaneousRequestsOnlyPrepareOne() {
        val guard = RecoveryConcurrencyGuard()
        val pool = Executors.newFixedThreadPool(8)
        val start = CountDownLatch(1)
        try {
            val futures = (1..16).map { i -> pool.submit<Boolean> {
                start.await()
                guard.begin("request-$i", envelope, 12L, 12L)
                    is RecoveryConcurrencyGuard.Decision.Prepared
            } }
            start.countDown()
            assertEquals(1, futures.count { it.get(10, TimeUnit.SECONDS) })
        } finally {
            pool.shutdownNow()
        }
    }
}

package com.salonbook.pro

/**
 * Phase 56.4: synthetic, in-memory failure simulator only.
 * The original snapshot is immutable; staged data is never written externally.
 * No disk, Android, Firebase, or production recovery integration.
 */
internal class RecoveryCrashSimulator(private val original: RecoveryTransaction.Snapshot) {
    enum class FailurePoint { BEFORE_PREPARE, AFTER_PREPARE, DURING_STAGING, BEFORE_FINALIZE }
    sealed class Outcome {
        data class Aborted(val reason: String, val unchanged: RecoveryTransaction.Snapshot) : Outcome()
        data class SimulatedSuccess(val unchanged: RecoveryTransaction.Snapshot) : Outcome()
    }

    fun run(
        point: FailurePoint?,
        envelope: VersionedSnapshotProtocol.Envelope,
        revision: Long,
        requestId: String = "synthetic-request"
    ): Outcome {
        val guard = RecoveryConcurrencyGuard()
        if (point == FailurePoint.BEFORE_PREPARE)
            return Outcome.Aborted("Interrupted before prepare", original)
        val result = guard.begin(requestId, envelope, revision, revision)
        if (result !is RecoveryConcurrencyGuard.Decision.Prepared)
            return Outcome.Aborted("Rejected during preparation", original)
        val ticket = result.ticket
        if (point == FailurePoint.AFTER_PREPARE) {
            guard.abort(ticket)
            return Outcome.Aborted("Interrupted after prepare", original)
        }
        // Staging is intentionally a local reference, never a storage mutation.
        val staged = envelope.snapshot.copy()
        if (point == FailurePoint.DURING_STAGING) {
            guard.abort(ticket)
            return Outcome.Aborted("Interrupted during staging", original)
        }
        if (point == FailurePoint.BEFORE_FINALIZE) {
            guard.abort(ticket)
            return Outcome.Aborted("Interrupted before finalize", original)
        }
        if (!guard.finish(ticket, revision))
            return Outcome.Aborted("Finalize rejected", original)
        // A successful simulation does not install staged data.
        @Suppress("UNUSED_VARIABLE")
        val verifiedOnly = staged
        return Outcome.SimulatedSuccess(original)
    }
}

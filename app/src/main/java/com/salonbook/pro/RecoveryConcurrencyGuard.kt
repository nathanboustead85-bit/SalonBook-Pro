package com.salonbook.pro

/**
 * Phase 56.3: in-memory, synthetic recovery planning only.
 * This guard never persists or restores data. A caller must supply external
 * cross-process locking and durable idempotency before any production use.
 */
internal class RecoveryConcurrencyGuard {
    data class Ticket(val requestId: String, val revision: Long, val digest: String)
    sealed class Decision {
        data class Prepared(val ticket: Ticket) : Decision()
        data class Rejected(val reason: String) : Decision()
    }

    private var active: Ticket? = null
    private val completed = mutableSetOf<String>()

    @Synchronized
    fun begin(requestId: String, envelope: VersionedSnapshotProtocol.Envelope?,
              currentRevision: Long?, expectedRevision: Long?): Decision {
        if (!Regex("^[A-Za-z0-9_-]{1,64}$").matches(requestId))
            return Decision.Rejected("Invalid request identifier")
        if (requestId in completed) return Decision.Rejected("Duplicate completed request")
        if (active != null) return Decision.Rejected("Another recovery is active")
        val checked = SnapshotRecoveryVerifier.verify(envelope, currentRevision, expectedRevision)
        if (checked !is SnapshotRecoveryVerifier.Verdict.Verified)
            return Decision.Rejected("Snapshot verification failed")
        val ticket = Ticket(requestId, checked.revision, envelope!!.sha256)
        active = ticket
        return Decision.Prepared(ticket)
    }

    /** Abort is deliberately idempotent and never changes external data. */
    @Synchronized
    fun abort(ticket: Ticket): Boolean {
        if (active != ticket) return false
        active = null
        return true
    }

    /**
     * Records a synthetic completed plan only after revalidating the revision.
     * This does NOT perform a restore or guarantee atomicity outside this object.
     */
    @Synchronized
    fun finish(ticket: Ticket, currentRevision: Long?): Boolean {
        if (active != ticket || currentRevision != ticket.revision) return false
        completed.add(ticket.requestId)
        active = null
        return true
    }
}

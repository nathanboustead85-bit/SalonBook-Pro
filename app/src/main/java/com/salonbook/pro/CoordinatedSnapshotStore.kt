package com.salonbook.pro

/**
 * Phase 56.2: in-memory, single-process synthetic transaction model.
 * NOT an Android store, durable commit, inter-process lock or Firebase adapter.
 * All accesses must use this same instance; external writers are not coordinated.
 */
internal class CoordinatedSnapshotStore(
    initial: RecoveryTransaction.Snapshot,
    initialRevision: Long = 0L
) {
    init { require(initialRevision >= 0 && initialRevision < Long.MAX_VALUE) }
    private var current = initial
    private var revision = initialRevision

    data class State(val revision: Long, val snapshot: RecoveryTransaction.Snapshot, val sha256: String)
    sealed class Update {
        data class Applied(val state: State) : Update()
        data class Rejected(val reason: String) : Update()
    }

    @Synchronized fun read(): State = state()

    /**
     * A failed or throwing transform never changes state. Compare-and-set
     * rejects stale revisions and refuses revision overflow.
     */
    @Synchronized fun update(
        expectedRevision: Long,
        transform: (RecoveryTransaction.Snapshot) -> RecoveryTransaction.Snapshot
    ): Update {
        if (expectedRevision != revision) return Update.Rejected("Revision conflict")
        if (revision == Long.MAX_VALUE - 1) return Update.Rejected("Revision exhausted")
        val candidate = try { transform(current) }
            catch (_: Exception) { return Update.Rejected("Update interrupted") }
        if (!withinBounds(candidate)) return Update.Rejected("Payload too large")
        current = candidate
        revision++
        return Update.Applied(state())
    }

    private fun state(): State = State(revision, current, VersionedSnapshotProtocol.digest(current))

    private fun withinBounds(value: RecoveryTransaction.Snapshot): Boolean =
        listOf(value.bookings, value.services, value.staff)
            .all { it.toByteArray(Charsets.UTF_8).size <= 1_000_000 }
}

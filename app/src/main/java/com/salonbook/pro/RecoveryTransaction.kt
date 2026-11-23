package com.salonbook.pro

/**
 * Phase 53.1: isolated, in-memory recovery transaction prototype.
 *
 * This class does NOT access Android preferences, Firebase or disk.
 * It models a rollback transaction for a future persistent implementation.
 * No production restore path calls this class yet.
 */
internal class RecoveryTransaction(
    private val storage: RecoveryStore
) {
    data class Snapshot(
        val bookings: String,
        val services: String,
        val staff: String
    )

    interface RecoveryStore {
        fun read(): Snapshot
        fun write(snapshot: Snapshot)
    }

    sealed class Outcome {
        data object Applied : Outcome()
        data class RolledBack(val cause: String) : Outcome()
        data class RecoveryFailed(val cause: String) : Outcome()
    }

    fun applySynthetic(
        incoming: Snapshot,
        validate: (Snapshot) -> Boolean
    ): Outcome {
        val original = try {
            storage.read()
        } catch (error: Exception) {
            return Outcome.RecoveryFailed("Cannot read original snapshot")
        }

        if (!validate(original) || !validate(incoming)) {
            return Outcome.RecoveryFailed("Snapshot validation failed")
        }

        return try {
            storage.write(incoming)
            val observed = storage.read()
            if (observed != incoming || !validate(observed)) {
                throw IllegalStateException("Post-write verification failed")
            }
            Outcome.Applied
        } catch (error: Exception) {
            try {
                storage.write(original)
                val restored = storage.read()
                if (restored == original && validate(restored)) {
                    Outcome.RolledBack("Write or verification failed")
                } else {
                    Outcome.RecoveryFailed("Rollback verification failed")
                }
            } catch (rollbackError: Exception) {
                Outcome.RecoveryFailed("Rollback operation failed")
            }
        }
    }
}

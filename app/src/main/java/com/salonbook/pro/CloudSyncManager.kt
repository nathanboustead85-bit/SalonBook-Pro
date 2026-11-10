package com.salonbook.pro

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Source
import com.google.firebase.firestore.ListenerRegistration
import org.json.JSONArray
import java.util.concurrent.atomic.AtomicBoolean

/**
 * BOUSTIO — PHASE 8D.62
 *
 * Legacy Android cloud-sync safety.
 *
 * Booking uploads:
 * - Require a successful server read first.
 * - Reject offline / unverifiable status.
 * - Wait for server acknowledgement.
 * - Rely on Firestore rules for the final
 *   migration-completion write restriction.
 *
 * IMPORTANT:
 * This is NOT a complete atomic migration
 * cutover or a production-ready booking engine.
 */
class CloudSyncManager {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private val allowedKeys = setOf(
        "bookings",
        "services",
        "staff"
    )

    enum class SyncStatus {
        SYNCED,
        PENDING,
        ERROR,
        SIGNED_OUT
    }

    private fun userId(): String {
        val user = auth.currentUser
            ?: error("Please sign in first")

        check(user.isEmailVerified) {
            "Please verify your email first"
        }

        return user.uid
    }

    private fun document(key: String) =
        db.collection("users")
            .document(userId())
            .collection("liveData")
            .document(key)

    /**
     * Validate JSON and prepare the same
     * Firestore document schema used by
     * previous Boustio Android builds.
     */
    private fun uploadData(
        json: String
    ): Map<String, Any> {

        JSONArray(json)

        return mapOf(
            "json" to json,
            "schemaVersion" to 1,
            "updatedAt" to FieldValue.serverTimestamp()
        )
    }

    /**
     * Reject a stale phone snapshot that would delete a booking created on
     * another device. IDs are checked inside the Firestore transaction.
     * This is a conservative legacy safety gate, not a two-way merge.
     */
    private fun assertNoRemoteBookingsLost(remoteJson: String?, localJson: String) {
        if (remoteJson == null) return
        val remote = JSONArray(remoteJson)
        val local = JSONArray(localJson)
        val localIds = mutableSetOf<String>()
        for (index in 0 until local.length()) {
            val id = local.getJSONObject(index).optString("id")
            require(id.isNotBlank() && localIds.add(id)) {
                "Invalid or duplicate local booking ID; upload blocked"
            }
        }
        for (index in 0 until remote.length()) {
            val id = remote.getJSONObject(index).optString("id")
            check(id.isNotBlank() && id in localIds) {
                "Cloud contains a booking missing from this phone. " +
                    "Upload blocked to protect another device's data."
            }
        }
    }

    /**
     * Upload services, staff or bookings.
     *
     * Booking uploads must first establish
     * server connectivity.
     *
     * This check does not prove migration
     * is incomplete. The Firestore rules
     * enforce the migration marker check
     * when the write reaches the server.
     */
    fun upload(
        key: String,
        json: String,
        callback: (Result<Unit>) -> Unit
    ) {
        val completed = AtomicBoolean(false)

        fun finish(result: Result<Unit>) {
            if (completed.compareAndSet(false, true)) {
                callback(result)
            }
        }

        try {
            require(key in allowedKeys) {
                "Invalid sync category"
            }

            val ownerAtStart = userId()
            val data = uploadData(json)
            val reference = document(key)

            if (key != "bookings") {
                reference.set(data)
                    .addOnSuccessListener {
                        finish(Result.success(Unit))
                    }
                    .addOnFailureListener { error ->
                        finish(Result.failure(error))
                    }

                return
            }

            /*
             * Phase 11.33: preserve the legacy server preflight, then use
             * an atomic Firestore transaction. A concurrent writer forces
             * the transaction to retry and recheck its latest booking IDs.
             * Never silently remove another device's newly added booking.
             */
            reference.get(Source.SERVER)
                .addOnSuccessListener { preflight ->
                    try {
                        check(userId() == ownerAtStart) {
                            "Account changed during sync"
                        }
                        if (preflight.exists()) {
                            check(preflight.getLong("schemaVersion") == 1L) {
                                "Unsupported cloud booking schema; upload blocked"
                            }
                            assertNoRemoteBookingsLost(preflight.getString("json"), json)
                        }
                        db.runTransaction { transaction ->
                            check(userId() == ownerAtStart) {
                                "Account changed during sync"
                            }
                            val latest = transaction.get(reference)
                            // If another device changes the snapshot between the
                            // verified preflight and this transaction, fail closed.
                            // Do not replace an edited or deleted appointment.
                            check(latest.exists() == preflight.exists() &&
                                (!latest.exists() ||
                                    latest.getString("json") == preflight.getString("json"))) {
                                "Cloud bookings changed during upload. " +
                                    "Refresh before trying again."
                            }
                            if (latest.exists()) {
                                check(latest.getLong("schemaVersion") == 1L) {
                                    "Unsupported cloud booking schema; upload blocked"
                                }
                                assertNoRemoteBookingsLost(latest.getString("json"), json)
                            }
                            transaction.set(reference, data)
                            Unit
                        }.addOnSuccessListener {
                            finish(Result.success(Unit))
                        }.addOnFailureListener { error ->
                            finish(Result.failure(IllegalStateException(
                                "Booking cloud update blocked or failed. " +
                                    "Review the server bookings before retrying.", error
                            )))
                        }
                    } catch (e: Exception) {
                        finish(Result.failure(e))
                    }
                }
                .addOnFailureListener { error ->
                    finish(Result.failure(IllegalStateException(
                        "Cannot verify cloud connectivity. " +
                            "Legacy booking upload has been blocked.", error
                    )))
                }

        } catch (e: Exception) {
            finish(Result.failure(e))
        }
    }

    /**
     * Download verified server data.
     *
     * Never silently substitute stale
     * cached data for a server response.
     */
    fun download(
        key: String,
        callback: (Result<String?>) -> Unit
    ) {
        try {
            require(key in allowedKeys) {
                "Invalid sync category"
            }

            document(key)
                .get(Source.SERVER)
                .addOnSuccessListener { snapshot ->

                    try {
                        val json =
                            if (snapshot.exists()) {
                                snapshot.getString("json")
                                    ?: error(
                                        "Invalid cloud data"
                                    )
                            } else {
                                null
                            }

                        if (json != null) {
                            JSONArray(json)
                        }

                        callback(
                            Result.success(json)
                        )

                    } catch (e: Exception) {
                        callback(
                            Result.failure(e)
                        )
                    }
                }
                .addOnFailureListener { error ->
                    callback(Result.failure(error))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }

    /**
     * Observe Firestore synchronization.
     *
     * PENDING indicates cached data or
     * locally pending writes.
     */
    fun observeSyncStatus(
        key: String,
        callback: (SyncStatus) -> Unit
    ): ListenerRegistration? {

        return try {
            require(key in allowedKeys) {
                "Invalid sync category"
            }

            val reference = document(key)

            reference.addSnapshotListener(
                MetadataChanges.INCLUDE
            ) { snapshot, error ->

                if (error != null || snapshot == null) {
                    callback(SyncStatus.ERROR)
                    return@addSnapshotListener
                }

                val metadata = snapshot.metadata

                when {
                    metadata.hasPendingWrites() -> {
                        callback(SyncStatus.PENDING)
                    }

                    metadata.isFromCache -> {
                        callback(SyncStatus.PENDING)
                    }

                    else -> {
                        callback(SyncStatus.SYNCED)
                    }
                }
            }

        } catch (e: Exception) {
            callback(
                if (auth.currentUser == null) {
                    SyncStatus.SIGNED_OUT
                } else {
                    SyncStatus.ERROR
                }
            )
            null
        }
    }

    /**
     * Wait for pending Firestore writes.
     *
     * This does not independently prove
     * that a migration can safely begin.
     */
    fun waitForPendingUploads(
        callback: (Result<Unit>) -> Unit
    ) {
        try {
            userId()

            db.waitForPendingWrites()
                .addOnSuccessListener {
                    callback(
                        Result.success(Unit)
                    )
                }
                .addOnFailureListener { error ->
                    callback(
                        Result.failure(error)
                    )
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }
}

package com.salonbook.pro

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Source
import com.google.firebase.firestore.ListenerRegistration
import org.json.JSONArray

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

    /*
     * Upload data to Firestore.
     *
     * Firestore queues writes locally when offline.
     * The success callback fires when the server
     * acknowledges the write.
     */
    fun upload(
        key: String,
        json: String,
        callback: (Result<Unit>) -> Unit
    ) {
        try {
            require(key in allowedKeys) {
                "Invalid sync category"
            }

            JSONArray(json)

            val data = mapOf(
                "json" to json,
                "schemaVersion" to 1,
                "updatedAt" to FieldValue.serverTimestamp()
            )

            document(key)
                .set(data)
                .addOnSuccessListener {
                    callback(Result.success(Unit))
                }
                .addOnFailureListener { error ->
                    callback(Result.failure(error))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }

    /*
     * Download verified server data.
     *
     * This deliberately reads from SERVER,
     * rather than silently restoring stale
     * cached information.
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

    /*
     * Observe the synchronization status
     * of a Firestore document.
     *
     * PENDING means Firestore has local
     * writes that the server has not yet
     * acknowledged.
     *
     * SYNCED means the snapshot came from
     * the server with no pending writes.
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

                if (error != null) {
                    callback(SyncStatus.ERROR)
                    return@addSnapshotListener
                }

                if (snapshot == null) {
                    callback(SyncStatus.ERROR)
                    return@addSnapshotListener
                }

                val metadata = snapshot.metadata

                when {
                    metadata.hasPendingWrites() -> {
                        callback(SyncStatus.PENDING)
                    }

                    metadata.isFromCache -> {
                        // Cached data alone does not
                        // prove server synchronization.
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

    /*
     * Wait for currently pending Firestore
     * writes to be acknowledged.
     *
     * This is useful for a manual
     * "Check Sync" action.
     *
     * When offline, completion can remain
     * pending until connectivity returns.
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

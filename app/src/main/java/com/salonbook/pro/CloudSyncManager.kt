package com.salonbook.pro

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.Source
import org.json.JSONArray

class CloudSyncManager {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private val allowedKeys = setOf(
        "bookings", "services", "staff"
    )

    private fun userId(): String {
        val user = auth.currentUser
            ?: error("Please sign in first")

        check(user.isEmailVerified) {
            "Please verify your email first"
        }

        return user.uid
    }

    fun upload(
        key: String,
        json: String,
        callback: (Result<Unit>) -> Unit
    ) {
        try {
            require(key in allowedKeys)
            JSONArray(json)

            val uid = userId()

            val data = mapOf(
                "json" to json,
                "schemaVersion" to 1,
                "updatedAt" to FieldValue.serverTimestamp()
            )

            db.collection("users")
                .document(uid)
                .collection("liveData")
                .document(key)
                .set(data)
                .addOnSuccessListener {
                    callback(Result.success(Unit))
                }
                .addOnFailureListener {
                    callback(Result.failure(it))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }

    fun download(
        key: String,
        callback: (Result<String?>) -> Unit
    ) {
        try {
            require(key in allowedKeys)

            val uid = userId()

            db.collection("users")
                .document(uid)
                .collection("liveData")
                .document(key)
                .get(Source.SERVER)
                .addOnSuccessListener { document ->
                    try {
                        val json = if (document.exists()) {
                            document.getString("json")
                                ?: error("Invalid cloud data")
                        } else {
                            null
                        }

                        if (json != null) JSONArray(json)

                        callback(Result.success(json))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                }
                .addOnFailureListener {
                    callback(Result.failure(it))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }
}

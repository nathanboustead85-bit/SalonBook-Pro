package com.salonbook.pro

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source

/**
 * BOUSTIO — PHASE 8D.65
 *
 * Server-controlled booking mode.
 *
 * Never trust cached mode data to
 * authorise legacy booking changes.
 */
class BookingModeManager {

    enum class BookingMode {
        LEGACY,
        FROZEN,
        CLOUD,
        UNAVAILABLE
    }

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    fun checkMode(
        callback: (Result<BookingMode>) -> Unit
    ) {
        val user = auth.currentUser

        if (user == null || !user.isEmailVerified) {
            callback(
                Result.success(
                    BookingMode.UNAVAILABLE
                )
            )
            return
        }

        val expectedUid = user.uid

        db.collection("businesses")
            .document(expectedUid)
            .collection("settings")
            .document("bookingMode")
            .get(Source.SERVER)
            .addOnSuccessListener { snapshot ->

                if (auth.currentUser?.uid != expectedUid) {
                    callback(
                        Result.success(
                            BookingMode.UNAVAILABLE
                        )
                    )
                    return@addOnSuccessListener
                }

                if (!snapshot.exists()) {
                    callback(
                        Result.success(
                            BookingMode.UNAVAILABLE
                        )
                    )
                    return@addOnSuccessListener
                }

                val mode = when (
                    snapshot.getString("mode")
                ) {
                    "legacy" -> BookingMode.LEGACY
                    "frozen" -> BookingMode.FROZEN
                    "cloud" -> BookingMode.CLOUD
                    else -> BookingMode.UNAVAILABLE
                }

                callback(Result.success(mode))
            }
            .addOnFailureListener { error ->
                callback(Result.failure(error))
            }
    }

    /**
     * Fail-closed check for legacy
     * Android booking mutations.
     */
    fun canEditLegacyBookings(
        callback: (Boolean) -> Unit
    ) {
        checkMode { result ->
            callback(
                result.getOrNull() ==
                    BookingMode.LEGACY
            )
        }
    }
}

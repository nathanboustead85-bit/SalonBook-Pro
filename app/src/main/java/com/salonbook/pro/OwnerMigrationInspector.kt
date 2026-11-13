package com.salonbook.pro

import com.google.android.gms.tasks.Task
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.HttpsCallableResult

/**
 * Phase: owner-authenticated, read-only cloud migration inspection.
 *
 * Never accepts a UID from the UI: the callable derives the business owner
 * from the verified Firebase Auth token. Does not write or migrate bookings.
 * This helper is deliberately not wired to an automatic startup action.
 */
object OwnerMigrationInspector {
    private const val REGION = "europe-west2"
    private const val CALLABLE = "inspectLegacyBookingMigration"

    fun inspect(): Task<HttpsCallableResult> {
        val user = FirebaseAuth.getInstance().currentUser
            ?: throw IllegalStateException("Sign in to Boustio before inspecting bookings")
        if (!user.isEmailVerified) {
            throw IllegalStateException("Verify your Firebase email before inspecting bookings")
        }
        // The Firebase Functions SDK attaches the current Firebase Auth ID token.
        // The backend independently checks auth.uid and email_verified.
        return FirebaseFunctions.getInstance(REGION).getHttpsCallable(CALLABLE)
            .call(emptyMap<String, Any>())
    }
}

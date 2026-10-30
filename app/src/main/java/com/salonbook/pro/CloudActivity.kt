package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Source

import org.json.JSONArray

class CloudActivity : Activity() {

    private val auth by lazy {
        FirebaseAuth.getInstance()
    }

    private val db by lazy {
        FirebaseFirestore.getInstance()
    }

    private val prefs by lazy {
        getSharedPreferences(
            "salonbook_data",
            MODE_PRIVATE
        )
    }

    private lateinit var layout: LinearLayout

    private val purple = Color.rgb(111, 66, 193)

    // PHASE 6C: CLOUD SYNC MONITORING

    private val syncListeners =
        mutableListOf<ListenerRegistration>()

    private val syncStates =
        mutableMapOf<String, CloudSyncManager.SyncStatus>()

    private var syncStatusText: TextView? = null

    private val syncKeys = listOf(
        "bookings",
        "services",
        "staff"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        render()
    }

    override fun onDestroy() {
        stopSyncMonitoring()
        super.onDestroy()
    }

    private fun stopSyncMonitoring() {
        syncListeners.forEach {
            it.remove()
        }

        syncListeners.clear()
        syncStates.clear()
        syncStatusText = null
    }

    private fun startSyncMonitoring() {
        stopSyncMonitoring()

        addText(
            "Live Cloud Sync Status",
            21f
        )

        val statusView = TextView(this).apply {
            text = "Checking cloud connection..."
            textSize = 17f
            setTextColor(Color.DKGRAY)
            setPadding(8, 16, 8, 16)
        }

        layout.addView(statusView)
        syncStatusText = statusView

        val manager = CloudSyncManager()

        syncKeys.forEach { key ->

            val listener = manager.observeSyncStatus(
                key
            ) { status ->

                runOnUiThread {

                    if (syncStatusText !== statusView) {
                        return@runOnUiThread
                    }

                    syncStates[key] = status
                    updateSyncStatus()
                }
            }

            if (listener != null) {
                syncListeners.add(listener)
            }
        }

        addText(
            "Connected means Firebase has responded " +
                "and there are no pending writes for " +
                "that cloud document. It does not " +
                "guarantee that this phone and the " +
                "cloud contain identical records.",
            13f
        )
    }

    private fun updateSyncStatus() {

        val lines = syncKeys.map { key ->

            val label = key.replaceFirstChar {
                it.uppercase()
            }

            val description = when (
                syncStates[key]
            ) {

                CloudSyncManager.SyncStatus.SYNCED ->
                    "Connected - no pending writes"

                CloudSyncManager.SyncStatus.PENDING ->
                    "Pending / cached / offline"

                CloudSyncManager.SyncStatus.ERROR ->
                    "Connection error"

                CloudSyncManager.SyncStatus.SIGNED_OUT ->
                    "Signed out"

                null ->
                    "Checking..."
            }

            "$label: $description"
        }

        syncStatusText?.text =
            lines.joinToString("\n")
    }

    // MAIN CLOUD SCREEN

    private fun render() {

        stopSyncMonitoring()

        val scroll = ScrollView(this).apply {
            setBackgroundColor(
                Color.rgb(248, 246, 252)
            )
        }

        layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 36, 32, 40)
        }

        scroll.addView(layout)
        setContentView(scroll)

        addText(
            "SalonBook Pro Cloud",
            26f
        )

        addText(
            "Phase 6C - Cloud Sync Reliability"
        )

        val user = auth.currentUser

        if (user == null) {

            showLogin()

        } else {

            addText(
                "Signed in as:",
                16f
            )

            addText(
                user.email ?: user.uid,
                18f
            )

            if (!user.isEmailVerified) {

                addText(
                    "Verify your email before " +
                        "accessing cloud data."
                )

                addButton(
                    "Send Verification Email"
                ) {

                    user.sendEmailVerification()
                        .addOnSuccessListener {
                            message(
                                "Verification email sent"
                            )
                        }
                        .addOnFailureListener {
                            message(
                                it.localizedMessage
                                    ?: "Unable to send email"
                            )
                        }
                }

            } else {

                showBackupOptions()
            }

            addButton(
                "Refresh Account Status"
            ) {

                user.reload()
                    .addOnCompleteListener {
                        render()
                    }
            }

            addButton("Sign Out") {

                stopSyncMonitoring()
                auth.signOut()
                render()
            }
        }

        addButton(
            "Back to Dashboard"
        ) {
            finish()
        }
    }

    // FIREBASE LOGIN

    private fun showLogin() {

        val email = input(
            "Business Email"
        )

        val password = input(
            "Password (minimum 6 characters)",
            true
        )

        addButton("Sign In") {

            val e = email.text.toString().trim()
            val p = password.text.toString()

            if (e.isBlank() || p.isBlank()) {

                message(
                    "Enter your email and password"
                )

            } else {

                auth.signInWithEmailAndPassword(e, p)
                    .addOnSuccessListener {

                        message(
                            "Signed in successfully"
                        )

                        render()
                    }
                    .addOnFailureListener {

                        message(
                            it.localizedMessage
                                ?: "Sign-in failed"
                        )
                    }
            }
        }

        addButton(
            "Create Business Account"
        ) {

            val e = email.text.toString().trim()
            val p = password.text.toString()

            if (e.isBlank() || p.length < 6) {

                message(
                    "Enter an email and password " +
                        "of at least 6 characters"
                )

            } else {

                auth.createUserWithEmailAndPassword(
                    e,
                    p
                )
                    .addOnSuccessListener {

                        auth.currentUser
                            ?.sendEmailVerification()

                        message(
                            "Account created. Check " +
                                "your verification email."
                        )

                        render()
                    }
                    .addOnFailureListener {

                        message(
                            it.localizedMessage
                                ?: "Registration failed"
                        )
                    }
            }
        }

        addButton("Reset Password") {

            val e = email.text.toString().trim()

            if (e.isBlank()) {

                message(
                    "Enter your email first"
                )

            } else {

                auth.sendPasswordResetEmail(e)
                    .addOnSuccessListener {

                        message(
                            "If eligible, a password " +
                                "reset email has been sent"
                        )
                    }
                    .addOnFailureListener {

                        message(
                            it.localizedMessage
                                ?: "Reset failed"
                        )
                    }
            }
        }
    }

    // CLOUD OPTIONS

    private fun showBackupOptions() {

        addText(
            "Cloud Backup",
            21f
        )

        // PHASE 6C STATUS INDICATOR

        startSyncMonitoring()

        // FIREBASE CONNECTION TEST

        addText(
            "Cloud Connection Test",
            19f
        )

        addText(
            "Check the Firebase connection " +
                "without changing your saved bookings."
        )

        addButton(
            "Test Cloud Sync Connection"
        ) {

            message(
                "Checking Firebase connection..."
            )

            CloudSyncManager().download(
                "bookings"
            ) { result ->

                runOnUiThread {

                    result.fold(

                        onSuccess = { json ->

                            if (json == null) {

                                message(
                                    "Connection successful. " +
                                        "No live cloud bookings yet."
                                )

                            } else {

                                message(
                                    "Connection successful. " +
                                        "Cloud booking data found."
                                )
                            }
                        },

                        onFailure = { error ->

                            message(
                                "Cloud connection failed: " +
                                    (error.localizedMessage
                                        ?: "Unknown error")
                            )
                        }
                    )
                }
            }
        }

        // EXISTING MANUAL BACKUP

        addText(
            "Manual Cloud Backup",
            19f
        )

        addText(
            "Save your bookings, services " +
                "and staff to Firebase."
        )

        addButton(
            "Back Up to Cloud"
        ) {

            AlertDialog.Builder(this)
                .setTitle(
                    "Replace cloud backup?"
                )
                .setMessage(
                    "This will overwrite the previous " +
                        "cloud backup with data from " +
                        "this phone."
                )
                .setPositiveButton(
                    "Back Up"
                ) { _, _ ->

                    backup()
                }
                .setNegativeButton(
                    "Cancel",
                    null
                )
                .show()
        }

        addButton(
            "Restore from Cloud"
        ) {

            AlertDialog.Builder(this)
                .setTitle(
                    "Replace local data?"
                )
                .setMessage(
                    "This will replace all bookings, " +
                        "services and staff currently " +
                        "stored on this phone."
                )
                .setPositiveButton(
                    "Restore"
                ) { _, _ ->

                    restore()
                }
                .setNegativeButton(
                    "Cancel",
                    null
                )
                .show()
        }

        addText(
            "Manual backup and restore remain " +
                "available. Live sync monitoring " +
                "is being tested in Phase 6C."
        )
    }

    // FIRESTORE BACKUP LOCATION

    private fun backupDocument() =
        db.collection("users")
            .document(
                auth.currentUser!!.uid
            )
            .collection("backups")
            .document("latest")

    // MANUAL CLOUD BACKUP

    private fun backup() {

        val user = auth.currentUser ?: return

        if (!user.isEmailVerified) {

            message(
                "Verify your email first"
            )

            return
        }

        val bookings =
            prefs.getString(
                "bookings",
                "[]"
            ) ?: "[]"

        val services =
            prefs.getString(
                "services",
                "[]"
            ) ?: "[]"

        val staff =
            prefs.getString(
                "staff",
                "[]"
            ) ?: "[]"

        try {

            JSONArray(bookings)
            JSONArray(services)
            JSONArray(staff)

        } catch (_: Exception) {

            message(
                "Local data is invalid"
            )

            return
        }

        val data = hashMapOf<String, Any>(
            "bookings" to bookings,
            "services" to services,
            "staff" to staff,
            "schemaVersion" to 1,
            "updatedAt" to FieldValue.serverTimestamp()
        )

        backupDocument()
            .set(data)
            .addOnSuccessListener {

                message(
                    "Cloud backup completed successfully"
                )
            }
            .addOnFailureListener {

                message(
                    it.localizedMessage
                        ?: "Backup failed"
                )
            }
    }

    // RESTORE FROM FIREBASE

    private fun restore() {

        val user = auth.currentUser ?: return

        if (!user.isEmailVerified) {

            message(
                "Verify your email first"
            )

            return
        }

        backupDocument()
            .get(Source.SERVER)
            .addOnSuccessListener { document ->

                if (!document.exists()) {

                    message(
                        "No cloud backup found"
                    )

                    return@addOnSuccessListener
                }

                val bookings =
                    document.getString("bookings")

                val services =
                    document.getString("services")

                val staff =
                    document.getString("staff")

                if (
                    bookings == null ||
                    services == null ||
                    staff == null
                ) {

                    message(
                        "Backup is incomplete"
                    )

                    return@addOnSuccessListener
                }

                try {

                    JSONArray(bookings)
                    JSONArray(services)
                    JSONArray(staff)

                } catch (_: Exception) {

                    message(
                        "Backup contains invalid data"
                    )

                    return@addOnSuccessListener
                }

                val saved = prefs.edit()
                    .putString(
                        "bookings",
                        bookings
                    )
                    .putString(
                        "services",
                        services
                    )
                    .putString(
                        "staff",
                        staff
                    )
                    .commit()

                if (saved) {

                    message(
                        "Restore complete. " +
                            "Return to dashboard."
                    )

                } else {

                    message(
                        "Unable to save restored data"
                    )
                }
            }
            .addOnFailureListener {

                message(
                    it.localizedMessage
                        ?: "Restore failed"
                )
            }
    }

    // INPUT FIELD HELPER

    private fun input(
        hintText: String,
        password: Boolean = false
    ): EditText {

        val field = EditText(this).apply {

            hint = hintText
            setSingleLine(true)

            inputType = if (password) {

                InputType.TYPE_CLASS_TEXT or
                    InputType.TYPE_TEXT_VARIATION_PASSWORD

            } else {

                InputType.TYPE_CLASS_TEXT or
                    InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            }
        }

        layout.addView(field)

        return field
    }

    // TEXT HELPER

    private fun addText(
        value: String,
        size: Float = 16f
    ) {

        layout.addView(
            TextView(this).apply {

                text = value
                textSize = size

                setTextColor(
                    Color.rgb(40, 35, 55)
                )

                setPadding(
                    8,
                    12,
                    8,
                    12
                )
            }
        )
    }

    // BUTTON HELPER

    private fun addButton(
        label: String,
        action: () -> Unit
    ) {

        val button = Button(this).apply {

            text = label
            isAllCaps = false
            setTextColor(Color.WHITE)

            backgroundTintList =
                android.content.res.ColorStateList.valueOf(
                    purple
                )

            setOnClickListener {
                action()
            }
        }

        layout.addView(
            button,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {

                bottomMargin = 12
            }
        )
    }

    // MESSAGE HELPER

    private fun message(
        value: String
    ) {

        Toast.makeText(
            this,
            value,
            Toast.LENGTH_LONG
        ).show()
    }
}

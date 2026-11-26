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
import com.google.firebase.firestore.FirebaseFirestore
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
        getSharedPreferences("salonbook_data", MODE_PRIVATE)
    }

    private lateinit var layout: LinearLayout

    private val purple = Color.rgb(0, 105, 100)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        render()
    }

    private fun render() {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(244, 250, 249))
        }

        layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 36, 32, 40)
        }

        scroll.addView(layout)
        setContentView(scroll)

        addText("Boustio Cloud", 26f)
        addText("Account & Cloud Backup")

        val user = auth.currentUser

        if (user == null) {
            showLogin()
        } else {
            addText("Signed in as:", 16f)
            addText(user.email ?: user.uid, 18f)

            if (!user.isEmailVerified) {
                addText(
                    "Verify your email before backing up salon data."
                )

                addButton("Send Verification Email") {
                    user.sendEmailVerification()
                        .addOnSuccessListener {
                            message("Verification email sent")
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

            addButton("Refresh Account Status") {
                user.reload()
                    .addOnCompleteListener {
                        render()
                    }
            }

            addButton("Sign Out") {
                auth.signOut()
                render()
            }
        }

        addButton("Back to Dashboard") {
            finish()
        }
    }

    private fun showLogin() {
        val email = input("Business Email")
        val password = input(
            "Password (minimum 6 characters)",
            true
        )

        addButton("Sign In") {
            val e = email.text.toString().trim()
            val p = password.text.toString()

            if (e.isBlank() || p.isBlank()) {
                message("Enter your email and password")
            } else {
                auth.signInWithEmailAndPassword(e, p)
                    .addOnSuccessListener {
                        message("Signed in successfully")
                        render()
                    }
                    .addOnFailureListener {
                        message(
                            it.localizedMessage ?: "Sign-in failed"
                        )
                    }
            }
        }

        addButton("Create Business Account") {
            val e = email.text.toString().trim()
            val p = password.text.toString()

            if (e.isBlank() || p.length < 6) {
                message(
                    "Enter an email and password of at least 6 characters"
                )
            } else {
                auth.createUserWithEmailAndPassword(e, p)
                    .addOnSuccessListener {
                        auth.currentUser?.sendEmailVerification()
                        message(
                            "Account created. Check your verification email."
                        )
                        render()
                    }
                    .addOnFailureListener {
                        message(
                            it.localizedMessage ?: "Registration failed"
                        )
                    }
            }
        }

        addButton("Reset Password") {
            val e = email.text.toString().trim()

            if (e.isBlank()) {
                message("Enter your email first")
            } else {
                auth.sendPasswordResetEmail(e)
                    .addOnSuccessListener {
                        message(
                            "If eligible, a password reset email has been sent"
                        )
                    }
                    .addOnFailureListener {
                        message(
                            it.localizedMessage ?: "Reset failed"
                        )
                    }
            }
        }
    }

    private fun showBackupOptions() {
        addText("Cloud Backup", 21f)

        addText(
            "Save your bookings, services and staff to Firebase."
        )

        addButton("Preview Local Backup") {
            AlertDialog.Builder(this)
                .setTitle("Preview local backup?")
                .setMessage(
                    "Inspect local bookings, services and staff. " +
                        "No cloud backup will be written."
                )
                .setPositiveButton("Preview") { _, _ ->
                    backup()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        addButton("Preview Cloud Restore") {
            AlertDialog.Builder(this)
                .setTitle("Preview cloud backup?")
                .setMessage(
                    "View cloud backup contents without replacing " +
                        "any bookings, services or staff on this phone."
                )
                .setPositiveButton("Preview") { _, _ ->
                    restore()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        addText(
            "Backup and restore are preview-only until independent " +
                "security approval. No cloud writes are permitted."
        )
    }

    private fun backupDocument(uid: String) =
        db.collection("users")
            .document(uid)
            .collection("backups")
            .document("latest")

    // Phase 52.7: local-only preview. Cloud backup writes are disabled
    // until owner isolation, rollback and overwrite safety are approved.
    private fun backup() {
        val user = auth.currentUser ?: return
        val uid = user.uid
        if (!user.isEmailVerified || auth.currentUser?.uid != uid) {
            message("Verify your account first")
            return
        }

        val bookings = prefs.getString("bookings", "[]") ?: "[]"
        val services = prefs.getString("services", "[]") ?: "[]"
        val staff = prefs.getString("staff", "[]") ?: "[]"
        if (bookings.length > 1_000_000 ||
            services.length > 1_000_000 ||
            staff.length > 1_000_000
        ) {
            message("Local backup data is too large")
            return
        }

        val counts = try {
            listOf(
                JSONArray(bookings).length(),
                JSONArray(services).length(),
                JSONArray(staff).length()
            )
        } catch (_: Exception) {
            message("Local data is invalid")
            return
        }

        if (auth.currentUser?.uid != uid ||
            auth.currentUser?.isEmailVerified != true
        ) {
            message("Account changed. Backup preview cancelled.")
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Cloud backup preview only")
            .setMessage(
                "This phone contains ${counts[0]} bookings, " +
                    "${counts[1]} services and ${counts[2]} staff. " +
                    "No cloud data was written. Cloud backup is disabled " +
                    "until account-isolation and overwrite checks pass."
            )
            .setPositiveButton("Close", null)
            .show()
    }

    // Phase 52.4: preview-only, fail-closed restore inspection.
    // No local preferences are changed by this function.
    private fun restore() {
        val user = auth.currentUser ?: return
        val uid = user.uid

        if (!user.isEmailVerified) {
            message("Verify your email first")
            return
        }

        backupDocument(uid)
            .get(Source.SERVER)
            .addOnSuccessListener { document ->
                if (auth.currentUser?.uid != uid ||
                    auth.currentUser?.isEmailVerified != true
                ) {
                    message("Account changed. Restore preview cancelled.")
                    return@addOnSuccessListener
                }

                if (!document.exists()) {
                    message("No cloud backup found")
                    return@addOnSuccessListener
                }

                if (document.getLong("schemaVersion") != 1L) {
                    message("Unsupported cloud backup version")
                    return@addOnSuccessListener
                }

                val bookings = document.getString("bookings")
                val services = document.getString("services")
                val staff = document.getString("staff")
                if (bookings == null || services == null || staff == null) {
                    message("Backup is incomplete")
                    return@addOnSuccessListener
                }

                if (bookings.length > 1_000_000 ||
                    services.length > 1_000_000 ||
                    staff.length > 1_000_000
                ) {
                    message("Backup is too large")
                    return@addOnSuccessListener
                }

                val counts = try {
                    listOf(
                        JSONArray(bookings).length(),
                        JSONArray(services).length(),
                        JSONArray(staff).length()
                    )
                } catch (_: Exception) {
                    message("Backup contains invalid data")
                    return@addOnSuccessListener
                }

                AlertDialog.Builder(this)
                    .setTitle("Cloud restore preview only")
                    .setMessage(
                        "Cloud backup contains ${counts[0]} bookings, " +
                            "${counts[1]} services and ${counts[2]} staff. " +
                            "Your existing phone data has NOT been changed. " +
                            "Restoring is disabled until rollback and " +
                            "data-protection checks are completed."
                    )
                    .setPositiveButton("Close", null)
                    .show()
            }
            .addOnFailureListener {
                message(it.localizedMessage ?: "Restore preview failed")
            }
    }

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

    private fun addText(
        value: String,
        size: Float = 16f
    ) {
        layout.addView(TextView(this).apply {
            text = value
            textSize = size
            setTextColor(Color.rgb(20, 49, 52))
            setPadding(8, 12, 8, 12)
        })
    }

    private fun addButton(
        label: String,
        action: () -> Unit
    ) {
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            setTextColor(Color.WHITE)

            backgroundTintList =
                android.content.res.ColorStateList.valueOf(purple)

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

    private fun message(value: String) {
        Toast.makeText(
            this,
            value,
            Toast.LENGTH_LONG
        ).show()
    }
}

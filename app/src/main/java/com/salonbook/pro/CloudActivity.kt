package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.google.firebase.FirebaseApp
import android.content.res.ColorStateList
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

import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Source

import org.json.JSONArray
import org.json.JSONObject

class CloudActivity : Activity() {

    private val orange = Color.rgb(0, 140, 149)
    private val dark = Color.rgb(32, 36, 43)
    private val backgroundColor = Color.rgb(250, 249, 247)

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

    private val syncListeners =
        mutableListOf<ListenerRegistration>()

    private val syncStates =
        mutableMapOf<String, CloudSyncManager.SyncStatus>()

    private var syncStatusText: TextView? = null

    private var pendingArchive: String? = null
    private var pendingArchiveHash: String? = null
    private val archiveRequestCode = 1011
    private val archiveReviewRequestCode = 1012

    private val syncKeys = listOf(
        "bookings", "services", "staff"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = orange
        window.navigationBarColor = backgroundColor
        render()
    }

    override fun onDestroy() {
        stopSyncMonitoring()
        super.onDestroy()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun stopSyncMonitoring() {
        syncListeners.forEach { it.remove() }
        syncListeners.clear()
        syncStates.clear()
        syncStatusText = null
    }

    private fun startSyncMonitoring() {
        stopSyncMonitoring()

        addText("Live Cloud Sync Status", 21f)

        val statusView = TextView(this).apply {
            text = "Checking cloud connection..."
            textSize = 17f
            setTextColor(dark)
            setPadding(dp(8), dp(16), dp(8), dp(16))
        }

        layout.addView(statusView)
        syncStatusText = statusView

        val manager = CloudSyncManager()

        syncKeys.forEach { key ->
            val listener = manager.observeSyncStatus(key) { status ->
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

            val description = when (syncStates[key]) {
                CloudSyncManager.SyncStatus.SYNCED ->
                    "Connected - no pending writes"

                CloudSyncManager.SyncStatus.PENDING ->
                    "Pending / cached / offline"

                CloudSyncManager.SyncStatus.ERROR ->
                    "Connection error"

                CloudSyncManager.SyncStatus.SIGNED_OUT ->
                    "Signed out"

                null -> "Checking..."
            }

            "$label: $description"
        }

        syncStatusText?.text = lines.joinToString("\n")
    }

    private fun render() {
        stopSyncMonitoring()

        val scroll = ScrollView(this).apply {
            setBackgroundColor(backgroundColor)
            isFillViewport = true
        }

        layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(
                dp(20), dp(24), dp(20), dp(30)
            )
        }

        scroll.addView(layout)
        setContentView(scroll)

        addText("BOUSTIO CLOUD", 26f)
        addText("Your business data, securely backed up.")

        val user = auth.currentUser

        if (user == null) {
            showLogin()
        } else {
            addText("Signed in as:", 16f)
            addText(user.email ?: user.uid, 18f)

            if (!user.isEmailVerified) {
                addText(
                    "Verify your email before accessing cloud data."
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
                user.reload().addOnCompleteListener {
                    render()
                }
            }

            addButton("Sign Out") {
                stopSyncMonitoring()
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
            "Password (minimum 6 characters)", true
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
                    "Enter an email and password " +
                        "of at least 6 characters"
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

        startSyncMonitoring()

        if (BuildConfig.DEV_APP_CHECK) {
            addText("Development App Check Registration", 19f)
            addText("Copy your private device debug token. Do not share it in screenshots, chat or GitHub.")
            addButton("Copy Private Debug Token") {
                val key = FirebaseApp.getInstance().persistenceKey
                val store = getSharedPreferences(
                    "com.google.firebase.appcheck.debug.store.$key",
                    Context.MODE_PRIVATE
                )
                val secret = store.getString(
                    "com.google.firebase.appcheck.debug.DEBUG_SECRET", null
                )
                if (secret.isNullOrBlank()) {
                    message("No debug token found yet. Tap Test App Check Token, then try copying again.")
                } else {
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = ClipData.newPlainText("Boustio private App Check debug token", secret)
                    clip.description.extras = android.os.PersistableBundle().apply {
                        putBoolean("android.content.extra.IS_SENSITIVE", true)
                    }
                    clipboard.setPrimaryClip(clip)
                    message("Private debug token copied. Paste it only into Firebase App Check > Manage debug tokens.")
                }
            }
        }

        addText("App Check Diagnostic", 19f)
        addText("Check whether this installed APK can obtain a valid App Check token. No data is changed.")
        addButton("Test App Check Token") {
            message("Checking App Check token...")
            FirebaseAppCheck.getInstance().getAppCheckToken(true)
                .addOnSuccessListener { result ->
                    val token = result.token
                    message(if (token.isNotBlank()) {
                        "App Check token obtained successfully."
                    } else {
                        "App Check returned an empty token."
                    })
                }
                .addOnFailureListener { error ->
                    message("App Check token failed: " +
                        (error.localizedMessage ?: error.javaClass.simpleName))
                }
        }

        addText("Cloud Connection Test", 19f)
        addText(
            "Check the Firebase connection without " +
                "changing your saved bookings."
        )

        addButton("Test Cloud Sync Connection") {
            message("Checking Firebase connection...")

            CloudSyncManager().download("bookings") { result ->
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

        addText("Calendar Migration Readiness · Read Only", 19f)
        addText(
            "Compare this phone's saved appointments with the latest " +
                "server-confirmed cloud booking document. Nothing is uploaded or changed."
        )
        addButton("Check Booking Backup Match") {
            checkBookingBackupMatch()
        }

        addButton("View Cloud Bookings · Read Only") {
            viewCloudBookings()
        }

        addButton("Save Cloud Booking Archive · No Changes") {
            prepareCloudBookingArchive()
        }

        addButton("Check Cleanup Readiness · Read Only") {
            val intent = android.content.Intent(
                android.content.Intent.ACTION_OPEN_DOCUMENT
            ).apply {
                addCategory(android.content.Intent.CATEGORY_OPENABLE)
                type = "application/json"
            }
            startActivityForResult(intent, archiveReviewRequestCode)
        }

        addText("Manual Cloud Backup", 19f)
        addText(
            "Save bookings, services, staff and registered clients to Firebase."
        )

        addButton("Back Up to Cloud") {
            AlertDialog.Builder(this)
                .setTitle("Replace cloud backup?")
                .setMessage(
                    "This will overwrite the previous cloud " +
                        "backup with data from this phone."
                )
                .setPositiveButton("Back Up") { _, _ ->
                    backup()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        addButton("Restore from Cloud") {
            AlertDialog.Builder(this)
                .setTitle("Replace local data?")
                .setMessage(
                    "This will replace bookings, services, staff and client data " +
                        "on this phone if included in the backup."
                )
                .setPositiveButton("Restore") { _, _ ->
                    restore()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        addText(
            "Manual backup and restore remain available. " +
                "Live sync monitoring is being tested.",
            14f
        )
    }

    private fun checkCleanupReadiness(uri: android.net.Uri) {
        val user = auth.currentUser
        if (user == null || !user.isEmailVerified) {
            message("Verified business sign-in required")
            return
        }
        val archiveHash: String
        try {
            val text = contentResolver.openInputStream(uri).use { input ->
                if (input == null) throw IllegalArgumentException("Archive cannot be opened")
                val bytes = input.readBytes()
                if (bytes.size > 2_000_000) {
                    throw IllegalArgumentException("Archive is too large")
                }
                bytes.toString(Charsets.UTF_8)
            }
            val archive = JSONObject(text)
            if (archive.getString("archiveType") != "boustio-cloud-bookings-readonly" ||
                archive.getInt("schemaVersion") != 1 ||
                archive.getInt("bookingCount") != 10) {
                throw IllegalArgumentException("Not a verified 10-booking archive")
            }
            val originalJson = archive.getString("bookingsJson")
            if (JSONArray(originalJson).length() != 10) {
                throw IllegalArgumentException("Archive booking count is inconsistent")
            }
            archiveHash = archive.getString("sourceSha256")
            if (!archiveHash.matches(Regex("[a-f0-9]{64}")) ||
                sha256(originalJson) != archiveHash) {
                throw IllegalArgumentException("Archive integrity check failed")
            }
        } catch (error: Exception) {
            showCleanupReview("BLOCKED: " +
                (error.localizedMessage ?: "Archive could not be verified"))
            return
        }
        db.collection("users").document(user.uid)
            .collection("liveData").document("bookings")
            .get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                try {
                    if (!snapshot.exists() || snapshot.getLong("schemaVersion") != 1L) {
                        throw IllegalArgumentException("Cloud booking source missing or invalid")
                    }
                    val raw = snapshot.getString("json")
                        ?: throw IllegalArgumentException("Cloud booking JSON missing")
                    val cloudCount = JSONArray(raw).length()
                    val match = cloudCount == 10 && sha256(raw) == archiveHash
                    showCleanupReview(
                        if (match) {
                            "ARCHIVE MATCH CONFIRMED\n\n" +
                                "All 10 cloud test bookings exactly match the saved archive. " +
                                "No changes were made. This is a preparation check only; " +
                                "cleanup is NOT authorised or enabled."
                        } else {
                            "BLOCKED: Firebase has changed since the archive was saved. " +
                                "Cloud booking count: $cloudCount. " +
                                "Do not delete or overwrite anything."
                        }
                    )
                } catch (error: Exception) {
                    showCleanupReview("BLOCKED: " +
                        (error.localizedMessage ?: "Invalid cloud data"))
                }
            }
            .addOnFailureListener { error ->
                showCleanupReview("BLOCKED: Fresh server verification failed. " +
                    (error.localizedMessage ?: "Connection error"))
            }
    }

    private fun showCleanupReview(result: String) {
        AlertDialog.Builder(this)
            .setTitle("Test Booking Cleanup Readiness")
            .setMessage(result)
            .setPositiveButton("Close", null)
            .show()
    }

    private fun prepareCloudBookingArchive() {
        val user = auth.currentUser
        if (user == null || !user.isEmailVerified) {
            message("Verified business sign-in required")
            return
        }
        pendingArchive = null
        pendingArchiveHash = null
        db.collection("users").document(user.uid)
            .collection("liveData").document("bookings")
            .get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                try {
                    if (!snapshot.exists() || snapshot.getLong("schemaVersion") != 1L) {
                        throw IllegalArgumentException("Cloud booking source is missing or unsupported")
                    }
                    val raw = snapshot.getString("json")
                        ?: throw IllegalArgumentException("Missing booking JSON")
                    val records = JSONArray(raw)
                    if (records.length() != 10) {
                        throw IllegalArgumentException(
                            "Expected 10 test bookings; found ${records.length()}. Archive cancelled."
                        )
                    }
                    for (i in 0 until records.length()) records.getJSONObject(i)
                    val sourceHash = sha256(raw)
                    val archive = JSONObject().apply {
                        put("archiveType", "boustio-cloud-bookings-readonly")
                        put("schemaVersion", 1)
                        put("sourcePath", "users/OWNER/liveData/bookings")
                        put("sourceSha256", sourceHash)
                        put("bookingCount", records.length())
                        put("bookingsJson", raw)
                    }.toString(2)
                    pendingArchive = archive
                    pendingArchiveHash = sourceHash
                    AlertDialog.Builder(this)
                        .setTitle("Save 10 test bookings")
                        .setMessage(
                            "A separate JSON archive will be saved to a location you choose. " +
                                "The original Firebase records will not change. " +
                                "Keep the archive private because it contains customer details."
                        )
                        .setPositiveButton("Choose file location") { _, _ ->
                            val intent = android.content.Intent(
                                android.content.Intent.ACTION_CREATE_DOCUMENT
                            ).apply {
                                addCategory(android.content.Intent.CATEGORY_OPENABLE)
                                type = "application/json"
                                putExtra(
                                    android.content.Intent.EXTRA_TITLE,
                                    "boustio-test-bookings-archive.json"
                                )
                            }
                            startActivityForResult(intent, archiveRequestCode)
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                } catch (error: Exception) {
                    pendingArchive = null
                    pendingArchiveHash = null
                    message(error.localizedMessage ?: "Archive preparation failed")
                }
            }
            .addOnFailureListener { error ->
                message("Server read failed: " +
                    (error.localizedMessage ?: "Connection error"))
            }
    }

    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: android.content.Intent?
    ) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == archiveReviewRequestCode) {
            if (resultCode == Activity.RESULT_OK && data?.data != null) {
                checkCleanupReadiness(data.data!!)
            }
            return
        }
        if (requestCode != archiveRequestCode) return
        val archive = pendingArchive
        val expectedHash = pendingArchiveHash
        pendingArchive = null
        pendingArchiveHash = null
        if (resultCode != Activity.RESULT_OK || data?.data == null ||
            archive == null || expectedHash == null) return
        try {
            val uri = data.data!!
            contentResolver.openOutputStream(uri, "wt").use { stream ->
                if (stream == null) throw IllegalStateException("Cannot open selected file")
                stream.write(archive.toByteArray(Charsets.UTF_8))
                stream.flush()
            }
            val saved = contentResolver.openInputStream(uri).use { stream ->
                if (stream == null) throw IllegalStateException("Cannot verify saved file")
                stream.readBytes().toString(Charsets.UTF_8)
            }
            val savedJson = JSONObject(saved)
            val savedRaw = savedJson.getString("bookingsJson")
            if (saved != archive || savedJson.getInt("bookingCount") != 10 ||
                savedJson.getString("sourceSha256") != expectedHash ||
                sha256(savedRaw) != expectedHash) {
                throw IllegalStateException("Saved file failed verification")
            }
            AlertDialog.Builder(this)
                .setTitle("Cloud booking archive verified")
                .setMessage(
                    "All 10 test bookings were saved and read back successfully. " +
                        "SHA-256: $expectedHash\n\n" +
                        "Firebase records remain untouched. Keep this file private."
                )
                .setPositiveButton("OK", null)
                .show()
        } catch (error: Exception) {
            AlertDialog.Builder(this)
                .setTitle("Archive not verified")
                .setMessage(
                    "Do not delete any bookings. File save or verification failed: " +
                        (error.localizedMessage ?: "Unknown error")
                )
                .setPositiveButton("OK", null)
                .show()
        }
    }

    private fun viewCloudBookings() {
        val user = auth.currentUser
        if (user == null || !user.isEmailVerified) {
            message("Verified business sign-in required")
            return
        }
        val progress = AlertDialog.Builder(this)
            .setTitle("Loading cloud bookings")
            .setMessage("Reading Firebase directly. Nothing will be changed.")
            .setCancelable(false)
            .create()
        progress.show()
        db.collection("users").document(user.uid)
            .collection("liveData").document("bookings")
            .get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                progress.dismiss()
                if (!snapshot.exists()) {
                    showCloudBookingList("No synced cloud bookings were found.")
                    return@addOnSuccessListener
                }
                try {
                    if (snapshot.getLong("schemaVersion") != 1L) {
                        throw IllegalArgumentException("Unsupported booking schema")
                    }
                    val raw = snapshot.getString("json")
                        ?: throw IllegalArgumentException("Booking JSON is missing")
                    val array = JSONArray(raw)
                    val items = mutableListOf<JSONObject>()
                    for (i in 0 until array.length()) {
                        items.add(array.getJSONObject(i))
                    }
                    items.sortWith(compareBy({ it.optString("date") }, { it.optString("time") }))
                    val lines = items.mapIndexed { index, item ->
                        val client = item.optString("client").ifBlank { "Not recorded" }
                        val service = item.optString("service").ifBlank { "Not recorded" }
                        val staff = item.optString("staffId").ifBlank { "Not recorded" }
                        val date = item.optString("date").ifBlank { "Not recorded" }
                        val time = item.optString("time").ifBlank { "Not recorded" }
                        val duration = item.optInt("duration", 0)
                        val price = item.optString("price")
                        buildString {
                            append("${index + 1}. $date at $time")
                            append("\nCustomer: $client")
                            append("\nService: $service")
                            append("\nStaff ID: $staff")
                            if (duration > 0) append("\nDuration: $duration minutes")
                            if (price.isNotBlank()) append("\nPrice: £$price")
                        }
                    }
                    showCloudBookingList(
                        if (lines.isEmpty()) "The cloud booking list is empty."
                        else "${items.size} cloud appointments (read only):\n\n" +
                            lines.joinToString("\n\n")
                    )
                } catch (error: Exception) {
                    showCloudBookingList(
                        "Unable to read cloud bookings: " +
                            (error.localizedMessage ?: "Invalid booking data")
                    )
                }
            }
            .addOnFailureListener { error ->
                progress.dismiss()
                showCloudBookingList(
                    "Server read failed: " +
                        (error.localizedMessage ?: "Connection error") +
                        ". No cached copy was used."
                )
            }
    }

    private fun showCloudBookingList(content: String) {
        val scroll = ScrollView(this)
        val details = TextView(this).apply {
            text = content
            textSize = 16f
            setTextColor(dark)
            setPadding(dp(20), dp(12), dp(20), dp(12))
        }
        scroll.addView(details)
        AlertDialog.Builder(this)
            .setTitle("Cloud Booking Records")
            .setView(scroll)
            .setPositiveButton("Close", null)
            .show()
    }

    private fun checkBookingBackupMatch() {
        val user = auth.currentUser
        if (user == null || !user.isEmailVerified) {
            message("Verified business sign-in required")
            return
        }
        val localJson = prefs.getString("bookings", "[]") ?: "[]"
        val localCount = try {
            JSONArray(localJson).length()
        } catch (_: Exception) {
            message("Local booking data is invalid")
            return
        }
        val progress = AlertDialog.Builder(this)
            .setTitle("Checking booking backup")
            .setMessage("Reading the latest server data. No appointments will be changed.")
            .setCancelable(false)
            .create()
        progress.show()
        db.collection("users").document(user.uid)
            .collection("liveData").document("bookings")
            .get(Source.SERVER)
            .addOnSuccessListener { snapshot ->
                progress.dismiss()
                if (!snapshot.exists()) {
                    showBookingMatchResult(
                        "No cloud booking sync document exists. Phone appointments: $localCount. " +
                            "Migration must remain blocked."
                    )
                    return@addOnSuccessListener
                }
                try {
                    if (snapshot.getLong("schemaVersion") != 1L) {
                        throw IllegalArgumentException("Unsupported cloud booking schema")
                    }
                    val cloudJson = snapshot.getString("json")
                        ?: throw IllegalArgumentException("Cloud booking JSON missing")
                    val cloudCount = JSONArray(cloudJson).length()
                    val localHash = sha256(localJson)
                    val cloudHash = sha256(cloudJson)
                    val match = localHash == cloudHash
                    showBookingMatchResult(
                        "Phone appointments: $localCount\n" +
                            "Cloud appointments: $cloudCount\n" +
                            "Exact data match: ${if (match) "YES" else "NO"}\n\n" +
                            if (match) {
                                "This phone's booking JSON matches the server copy. " +
                                    "Other devices, migration conflicts and booking locks " +
                                    "have NOT been verified. Do not enable live bookings."
                            } else {
                                "Migration blocked: this phone and the server have " +
                                    "different booking data. Do not overwrite either copy."
                            }
                    )
                } catch (error: Exception) {
                    showBookingMatchResult(
                        "Unable to verify cloud booking data: " +
                            (error.localizedMessage ?: "Invalid data") +
                            ". No appointments were changed."
                    )
                }
            }
            .addOnFailureListener { error ->
                progress.dismiss()
                showBookingMatchResult(
                    "Server verification unavailable: " +
                        (error.localizedMessage ?: "Connection error") +
                        ". Cached data was not used."
                )
            }
    }

    private fun sha256(value: String): String =
        java.security.MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    private fun showBookingMatchResult(result: String) {
        AlertDialog.Builder(this)
            .setTitle("Calendar Migration Readiness")
            .setMessage(result)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun backupDocument() =
        db.collection("users")
            .document(auth.currentUser!!.uid)
            .collection("backups")
            .document("latest")

    private fun backup() {
        val user = auth.currentUser ?: return

        if (!user.isEmailVerified) {
            message("Verify your email first")
            return
        }

        val bookings =
            prefs.getString("bookings", "[]") ?: "[]"

        val services =
            prefs.getString("services", "[]") ?: "[]"

        val staff =
            prefs.getString("staff", "[]") ?: "[]"

        try {
            JSONArray(bookings)
            JSONArray(services)
            JSONArray(staff)
        } catch (_: Exception) {
            message("Local data is invalid")
            return
        }

        val manualClients = prefs.getString("manual_clients", "[]") ?: "[]"
        val clientProfiles = JSONObject()
        try {
            val clients = JSONArray(manualClients)
            for (i in 0 until clients.length()) {
                val name = clients.getJSONObject(i).optString("name").trim()
                if (name.isNotEmpty()) {
                    val key = "client_profile_" + name.lowercase(java.util.Locale.UK)
                    val profile = prefs.getString(key, "{}") ?: "{}"
                    clientProfiles.put(key, JSONObject(profile))
                }
            }
            // Include profiles of booked clients as well.
            val booked = JSONArray(bookings)
            for (i in 0 until booked.length()) {
                val name = booked.getJSONObject(i).optString("client").trim()
                if (name.isNotEmpty()) {
                    val key = "client_profile_" + name.lowercase(java.util.Locale.UK)
                    val profile = prefs.getString(key, "{}") ?: "{}"
                    clientProfiles.put(key, JSONObject(profile))
                }
            }
        } catch (_: Exception) {
            message("Client data is invalid; backup cancelled")
            return
        }

        val data = hashMapOf<String, Any>(
            "bookings" to bookings,
            "services" to services,
            "staff" to staff,
            "manualClients" to manualClients,
            "clientProfiles" to clientProfiles.toString(),
            "schemaVersion" to 1,
            "updatedAt" to FieldValue.serverTimestamp()
        )

        backupDocument()
            .set(data)
            .addOnSuccessListener {
                message("Cloud backup completed successfully")
            }
            .addOnFailureListener {
                message(
                    it.localizedMessage ?: "Backup failed"
                )
            }
    }

    private fun restore() {
        val user = auth.currentUser
        if (user == null || !user.isEmailVerified) {
            message("Sign in with a verified email first")
            return
        }

        val progress = AlertDialog.Builder(this)
            .setTitle("Restoring cloud backup")
            .setMessage("Contacting Firebase. Your local data has not been changed yet.")
            .setCancelable(false)
            .create()
        progress.show()

        backupDocument().get(Source.SERVER)
            .addOnSuccessListener { document ->
                try {
                    if (!document.exists()) {
                        progress.dismiss()
                        showRestoreResult("No cloud backup found", false)
                        return@addOnSuccessListener
                    }
                    val bookings = document.getString("bookings")
                    val services = document.getString("services")
                    val staff = document.getString("staff")
                    if (bookings == null || services == null || staff == null) {
                        progress.dismiss()
                        showRestoreResult("Cloud backup is incomplete. Nothing was changed.", false)
                        return@addOnSuccessListener
                    }
                    // Parse and validate the entire backup before writing any local data.
                    JSONArray(bookings)
                    JSONArray(services)
                    JSONArray(staff)
                    val manualClients = document.getString("manualClients")
                    if (manualClients != null) JSONArray(manualClients)
                    val profilesRaw = document.getString("clientProfiles")
                    val profiles = if (profilesRaw != null) JSONObject(profilesRaw) else null
                    val validatedProfiles = mutableMapOf<String, String>()
                    if (profiles != null) {
                        val keys = profiles.keys()
                        while (keys.hasNext()) {
                            val key = keys.next()
                            if (!key.startsWith("client_profile_")) {
                                throw IllegalArgumentException("Invalid client profile key")
                            }
                            validatedProfiles[key] = profiles.getJSONObject(key).toString()
                        }
                    }
                    // Preserve existing local values if restoring an older backup.
                    val editor = prefs.edit()
                        .putString("bookings", bookings)
                        .putString("services", services)
                        .putString("staff", staff)
                    if (manualClients != null) editor.putString("manual_clients", manualClients)
                    validatedProfiles.forEach { (key, value) -> editor.putString(key, value) }
                    if (!editor.commit()) {
                        throw IllegalStateException("Phone storage refused the restore")
                    }
                    progress.dismiss()
                    showRestoreResult(
                        "Restore completed. Bookings, services and staff were restored." +
                            if (profiles != null) " Client profiles were restored too."
                            else " This older backup did not contain client profiles.",
                        true
                    )
                } catch (error: Exception) {
                    progress.dismiss()
                    showRestoreResult(
                        "Restore cancelled: ${error.localizedMessage ?: "Invalid backup data"}. " +
                            "No new restore data was saved.",
                        false
                    )
                }
            }
            .addOnFailureListener { error ->
                progress.dismiss()
                showRestoreResult(
                    "Firebase restore failed: ${error.localizedMessage ?: "Connection error"}. " +
                        "Your local data was not changed.",
                    false
                )
            }
    }

    private fun showRestoreResult(details: String, success: Boolean) {
        AlertDialog.Builder(this)
            .setTitle(if (success) "Cloud restore successful" else "Cloud restore not completed")
            .setMessage(details)
            .setPositiveButton("OK", null)
            .show()
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

            backgroundTintList =
                ColorStateList.valueOf(orange)
            setTextColor(dark)
            setHintTextColor(Color.GRAY)
        }

        layout.addView(field)
        return field
    }

    private fun addText(
        value: String,
        size: Float = 16f
    ) {
        layout.addView(
            TextView(this).apply {
                text = value
                textSize = size
                setTextColor(
                    if (size >= 21f) orange else dark
                )
                setPadding(
                    dp(8), dp(12), dp(8), dp(12)
                )
            }
        )
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
                ColorStateList.valueOf(orange)
            setOnClickListener { action() }
        }

        layout.addView(
            button,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(12)
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

package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.google.firebase.auth.FirebaseAuth

class BusinessProfileActivity : Activity() {

    companion object {
        private const val EXPORT_REQUEST = 701
    }

    private val purple = Color.rgb(111, 66, 193)
    private val dark = Color.rgb(40, 35, 55)
    private val backgroundColor = Color.rgb(248, 246, 252)

    private val manager = BusinessProfileManager()

    private val prefs by lazy {
        getSharedPreferences("salonbook_data", MODE_PRIVATE)
    }

    private lateinit var container: LinearLayout
    private lateinit var nameInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var addressInput: EditText
    private lateinit var descriptionInput: EditText
    private lateinit var categorySpinner: Spinner
    private lateinit var bookingSwitch: Switch
    private lateinit var slugText: TextView
    private lateinit var saveButton: Button
    private lateinit var previewButton: Button
    private lateinit var exportButton: Button

    private var loadingProfile = false
    private var profileLoaded = false
    private var catalogueLoading = false
    private var pendingExportJson: String? = null

    private val categories = listOf(
        "Hair Salon",
        "Barbershop",
        "Nail Salon",
        "Beauty Salon",
        "Lashes & Brows",
        "Massage & Wellness",
        "Mobile Professional",
        "Other"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val user = FirebaseAuth.getInstance().currentUser

        if (user == null || !user.isEmailVerified) {
            AlertDialog.Builder(this)
                .setTitle("Verified account required")
                .setMessage(
                    "Please sign in with your verified " +
                    "Firebase account through Cloud Account " +
                    "& Backup before creating your business profile."
                )
                .setPositiveButton("OK") { _, _ ->
                    finish()
                }
                .setCancelable(false)
                .show()
            return
        }

        buildScreen()
        loadProfile()
    }

    private fun buildScreen() {

        val scroll = ScrollView(this).apply {
            setBackgroundColor(backgroundColor)
            isFillViewport = true
        }

        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 40, 32, 48)
        }

        scroll.addView(container)
        setContentView(scroll)

        addTitle("Boustio Business Profile")

        addText(
            "Manage your business information and " +
            "prepare your public booking catalogue."
        )

        nameInput = addInput("Business name", false)
        phoneInput = addInput("Business telephone", false)
        addressInput = addInput("Business address", true)
        descriptionInput = addInput(
            "Business description", true
        )

        addText("Business category")

        categorySpinner = Spinner(this)

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            categories
        )

        adapter.setDropDownViewResource(
            android.R.layout.simple_spinner_dropdown_item
        )

        categorySpinner.adapter = adapter
        container.addView(categorySpinner)

        addText("Booking identifier")

        slugText = TextView(this).apply {
            text = "Save your profile to generate a booking ID"
            textSize = 15f
            setTextColor(purple)
            setPadding(8, 12, 8, 20)
        }

        container.addView(slugText)

        addText(
            "Your booking identifier will form part " +
            "of your future Boustio booking link."
        )

        bookingSwitch = Switch(this).apply {
            text = "Accept online bookings"
            textSize = 16f
            setTextColor(dark)
            isChecked = false
            isEnabled = false
        }

        container.addView(bookingSwitch)

        addText(
            "Online bookings remain disabled until " +
            "secure live booking integration is complete."
        )

        saveButton = addButton(
            "Save Business Profile"
        ) {
            saveProfile()
        }

        previewButton = addButton(
            "Preview Public Catalogue"
        ) {
            prepareCatalogue(export = false)
        }

        exportButton = addButton(
            "Export Catalogue JSON"
        ) {
            prepareCatalogue(export = true)
        }

        addText(
            "Preview or export your locally saved " +
            "services and staff together with your " +
            "saved Firebase business profile. " +
            "Exporting does not publish anything online.",
            14f
        )

        addButton("Back to Dashboard") {
            finish()
        }

        addText("Boustio | Phase 7E", 12f)
    }

    private fun addTitle(value: String) {
        container.addView(
            TextView(this).apply {
                text = value
                textSize = 27f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(purple)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 24)
            }
        )
    }

    private fun addText(
        value: String,
        size: Float = 16f
    ) {
        container.addView(
            TextView(this).apply {
                text = value
                textSize = size
                setTextColor(dark)
                setPadding(8, 12, 8, 12)
            }
        )
    }

    private fun addInput(
        hintText: String,
        multiline: Boolean
    ): EditText {

        val input = EditText(this).apply {
            hint = hintText
            textSize = 16f
            setTextColor(dark)
            setHintTextColor(Color.GRAY)

            if (multiline) {
                minLines = 2
                maxLines = 4
                inputType =
                    android.text.InputType.TYPE_CLASS_TEXT or
                    android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
            } else {
                setSingleLine(true)
            }
        }

        container.addView(
            input,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 14
            }
        )

        return input
    }

    private fun addButton(
        label: String,
        action: () -> Unit
    ): Button {

        val button = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 16f
            setTextColor(Color.WHITE)
            backgroundTintList =
                ColorStateList.valueOf(purple)

            setOnClickListener { action() }
        }

        container.addView(
            button,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 12
                bottomMargin = 8
            }
        )

        return button
    }

    private fun updateButtons() {
        val ready = profileLoaded &&
            !loadingProfile &&
            !catalogueLoading

        previewButton.isEnabled = ready
        exportButton.isEnabled = ready
    }

    private fun loadProfile() {
        loadingProfile = true
        saveButton.isEnabled = false
        updateButtons()

        manager.loadProfile { result ->

            runOnUiThread {
                if (isFinishing || isDestroyed) {
                    return@runOnUiThread
                }

                loadingProfile = false
                saveButton.isEnabled = true

                result.onSuccess { profile ->

                    if (profile == null) {
                        profileLoaded = false
                        slugText.text =
                            "Save your profile to generate a booking ID"
                        updateButtons()
                        return@onSuccess
                    }

                    profileLoaded = true

                    nameInput.setText(profile.name)
                    phoneInput.setText(profile.phone)
                    addressInput.setText(profile.address)
                    descriptionInput.setText(
                        profile.description
                    )

                    val categoryIndex =
                        categories.indexOf(profile.category)

                    if (categoryIndex >= 0) {
                        categorySpinner.setSelection(
                            categoryIndex
                        )
                    }

                    slugText.text =
                        "Booking ID: ${profile.slug}"

                    bookingSwitch.isChecked =
                        profile.acceptingBookings

                    updateButtons()
                }

                result.onFailure { error ->
                    profileLoaded = false
                    updateButtons()

                    showMessage(
                        "Unable to load profile: " +
                        (error.localizedMessage
                            ?: "Unknown error")
                    )
                }
            }
        }
    }

    private fun saveProfile() {

        if (loadingProfile || catalogueLoading) {
            return
        }

        val name = nameInput.text.toString().trim()
        val phone = phoneInput.text.toString().trim()
        val address = addressInput.text.toString().trim()
        val description =
            descriptionInput.text.toString().trim()

        if (name.length < 3) {
            nameInput.error =
                "Enter a business name of at least 3 characters"
            return
        }

        val category =
            categories[categorySpinner.selectedItemPosition]

        saveButton.isEnabled = false
        previewButton.isEnabled = false
        exportButton.isEnabled = false
        saveButton.text = "Saving..."

        manager.saveProfile(
            name = name,
            category = category,
            phone = phone,
            address = address,
            description = description
        ) { result ->

            runOnUiThread {
                if (isFinishing || isDestroyed) {
                    return@runOnUiThread
                }

                saveButton.isEnabled = true
                saveButton.text = "Save Business Profile"

                result.onSuccess { profile ->
                    profileLoaded = true
                    slugText.text =
                        "Booking ID: ${profile.slug}"

                    updateButtons()

                    showMessage(
                        "Business profile saved successfully"
                    )
                }

                result.onFailure { error ->
                    updateButtons()

                    AlertDialog.Builder(this)
                        .setTitle("Save failed")
                        .setMessage(
                            error.localizedMessage
                                ?: "Unable to save business profile"
                        )
                        .setPositiveButton("OK", null)
                        .show()
                }
            }
        }
    }

    private fun prepareCatalogue(export: Boolean) {

        if (
            loadingProfile ||
            !profileLoaded ||
            catalogueLoading
        ) {
            showMessage(
                "Save your business profile first"
            )
            return
        }

        catalogueLoading = true
        updateButtons()

        manager.loadProfile { result ->

            runOnUiThread {
                if (isFinishing || isDestroyed) {
                    return@runOnUiThread
                }

                catalogueLoading = false
                updateButtons()

                result.onSuccess { profile ->

                    if (profile == null) {
                        showMessage(
                            "Save your business profile first"
                        )
                        return@onSuccess
                    }

                    try {
                        val servicesJson =
                            prefs.getString(
                                "services", "[]"
                            ) ?: "[]"

                        val staffJson =
                            prefs.getString(
                                "staff", "[]"
                            ) ?: "[]"

                        val catalogue =
                            BusinessCatalogueBuilder.build(
                                profile = profile,
                                servicesJson = servicesJson,
                                staffJson = staffJson
                            )

                        val json = catalogue.toString(2)

                        if (export) {
                            confirmExport(
                                json,
                                profile.slug
                            )
                        } else {
                            showCataloguePreview(json)
                        }

                    } catch (error: Exception) {
                        showError(
                            "Catalogue failed",
                            error.localizedMessage
                                ?: "Unable to create catalogue"
                        )
                    }
                }

                result.onFailure { error ->
                    showError(
                        "Unable to load profile",
                        error.localizedMessage
                            ?: "Check your internet connection"
                    )
                }
            }
        }
    }

    private fun confirmExport(
        json: String,
        slug: String
    ) {

        AlertDialog.Builder(this)
            .setTitle("Export Boustio Catalogue")
            .setMessage(
                "Save a private preview JSON file " +
                "containing your business name, " +
                "description, address, services, " +
                "staff and working hours.\n\n" +
                "Review these details before sharing " +
                "or publishing the file.\n\n" +
                "This does not publish your business " +
                "or activate online bookings."
            )
            .setPositiveButton("Choose Save Location") { _, _ ->
                pendingExportJson = json

                val safeSlug = slug.replace(
                    Regex("[^a-z0-9-]"), ""
                ).ifBlank {
                    "business"
                }

                val intent = Intent(
                    Intent.ACTION_CREATE_DOCUMENT
                ).apply {
                    addCategory(
                        Intent.CATEGORY_OPENABLE
                    )
                    type = "application/json"
                    putExtra(
                        Intent.EXTRA_TITLE,
                        "$safeSlug.json"
                    )
                }

                try {
                    startActivityForResult(
                        intent,
                        EXPORT_REQUEST
                    )
                } catch (error: Exception) {
                    pendingExportJson = null
                    showError(
                        "Export unavailable",
                        error.localizedMessage
                            ?: "Unable to open file picker"
                    )
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    @Deprecated("Uses Android document picker result")
    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        super.onActivityResult(
            requestCode,
            resultCode,
            data
        )

        if (requestCode != EXPORT_REQUEST) {
            return
        }

        val json = pendingExportJson
        pendingExportJson = null

        if (
            resultCode != RESULT_OK ||
            data?.data == null ||
            json == null
        ) {
            return
        }

        try {
            val uri = data.data
                ?: error("No destination selected")

            contentResolver.openOutputStream(
                uri, "w"
            )?.use { output ->
                output.write(
                    json.toByteArray(Charsets.UTF_8)
                )
                output.flush()
            } ?: error("Unable to write file")

            AlertDialog.Builder(this)
                .setTitle("Catalogue exported")
                .setMessage(
                    "Your Boustio JSON file was saved " +
                    "successfully.\n\n" +
                    "It remains a private preview. " +
                    "No website publishing or online " +
                    "booking activation has occurred."
                )
                .setPositiveButton("OK", null)
                .show()

        } catch (error: Exception) {
            showError(
                "Export failed",
                error.localizedMessage
                    ?: "Unable to save JSON file"
            )
        }
    }

    private fun showCataloguePreview(json: String) {

        val scroll = ScrollView(this)

        val textView = TextView(this).apply {
            text = json
            textSize = 12f
            setTextColor(dark)
            setPadding(28, 24, 28, 24)
            setTextIsSelectable(true)
            typeface = Typeface.MONOSPACE
        }

        scroll.addView(textView)

        AlertDialog.Builder(this)
            .setTitle("Boustio Catalogue Preview")
            .setMessage(
                "PRIVATE PREVIEW ONLY\n" +
                "Not published. Online bookings disabled."
            )
            .setView(scroll)
            .setPositiveButton("Close", null)
            .show()
            .window?.setLayout(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
    }

    private fun showError(
        title: String,
        message: String
    ) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showMessage(message: String) {
        Toast.makeText(
            this,
            message,
            Toast.LENGTH_LONG
        ).show()
    }
}

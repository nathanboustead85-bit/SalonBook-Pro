package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
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

    private val purple = Color.rgb(111, 66, 193)
    private val dark = Color.rgb(40, 35, 55)
    private val backgroundColor = Color.rgb(248, 246, 252)

    private val manager = BusinessProfileManager()

    private val prefs by lazy {
        getSharedPreferences(
            "salonbook_data",
            MODE_PRIVATE
        )
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

    private var loadingProfile = false
    private var profileLoaded = false
    private var previewLoading = false

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

        nameInput = addInput(
            "Business name",
            false
        )

        phoneInput = addInput(
            "Business telephone",
            false
        )

        addressInput = addInput(
            "Business address",
            true
        )

        descriptionInput = addInput(
            "Business description",
            true
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
            previewCatalogue()
        }

        addText(
            "Preview uses your locally saved services " +
            "and staff, together with your business " +
            "profile from Firebase. It does not publish " +
            "anything online.",
            14f
        )

        addButton("Back to Dashboard") {
            finish()
        }

        addText(
            "Boustio | Phase 7D",
            12f
        )
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

            setOnClickListener {
                action()
            }
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

    private fun loadProfile() {
        loadingProfile = true
        saveButton.isEnabled = false
        previewButton.isEnabled = false

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
                        previewButton.isEnabled = false
                        slugText.text =
                            "Save your profile to generate a booking ID"
                        return@onSuccess
                    }

                    profileLoaded = true
                    previewButton.isEnabled = true

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
                }

                result.onFailure { error ->
                    profileLoaded = false
                    previewButton.isEnabled = false
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

        if (loadingProfile) {
            return
        }

        val name =
            nameInput.text.toString().trim()

        val phone =
            phoneInput.text.toString().trim()

        val address =
            addressInput.text.toString().trim()

        val description =
            descriptionInput.text.toString().trim()

        if (name.length < 3) {
            nameInput.error =
                "Enter a business name of at least 3 characters"
            return
        }

        val category =
            categories[
                categorySpinner.selectedItemPosition
            ]

        saveButton.isEnabled = false
        previewButton.isEnabled = false
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
                saveButton.text =
                    "Save Business Profile"

                result.onSuccess { profile ->

                    profileLoaded = true
                    previewButton.isEnabled = true

                    slugText.text =
                        "Booking ID: ${profile.slug}"

                    showMessage(
                        "Business profile saved successfully"
                    )
                }

                result.onFailure { error ->
                    previewButton.isEnabled = profileLoaded

                    AlertDialog.Builder(this)
                        .setTitle("Save failed")
                        .setMessage(
                            error.localizedMessage
                                ?: "Unable to save business profile"
                        )
                        .setPositiveButton(
                            "OK",
                            null
                        )
                        .show()
                }
            }
        }
    }

    private fun previewCatalogue() {

        if (
            loadingProfile ||
            !profileLoaded ||
            previewLoading
        ) {
            showMessage(
                "Save your business profile first"
            )
            return
        }

        previewLoading = true
        previewButton.isEnabled = false
        previewButton.text = "Preparing preview..."

        // Load the profile from Firebase so
        // the preview uses saved information,
        // not unsaved changes on the screen.
        manager.loadProfile { result ->

            runOnUiThread {
                if (isFinishing || isDestroyed) {
                    return@runOnUiThread
                }

                previewLoading = false
                previewButton.isEnabled = true
                previewButton.text =
                    "Preview Public Catalogue"

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
                                "services",
                                "[]"
                            ) ?: "[]"

                        val staffJson =
                            prefs.getString(
                                "staff",
                                "[]"
                            ) ?: "[]"

                        val catalogue =
                            BusinessCatalogueBuilder.build(
                                profile = profile,
                                servicesJson = servicesJson,
                                staffJson = staffJson
                            )

                        showCataloguePreview(
                            catalogue.toString(2)
                        )

                    } catch (error: Exception) {

                        AlertDialog.Builder(this)
                            .setTitle("Preview failed")
                            .setMessage(
                                error.localizedMessage
                                    ?: "Unable to create catalogue"
                            )
                            .setPositiveButton(
                                "OK",
                                null
                            )
                            .show()
                    }
                }

                result.onFailure { error ->

                    AlertDialog.Builder(this)
                        .setTitle("Unable to load profile")
                        .setMessage(
                            error.localizedMessage
                                ?: "Check your internet connection"
                        )
                        .setPositiveButton(
                            "OK",
                            null
                        )
                        .show()
                }
            }
        }
    }

    private fun showCataloguePreview(
        json: String
    ) {

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

    private fun showMessage(message: String) {
        Toast.makeText(
            this,
            message,
            Toast.LENGTH_LONG
        ).show()
    }
}

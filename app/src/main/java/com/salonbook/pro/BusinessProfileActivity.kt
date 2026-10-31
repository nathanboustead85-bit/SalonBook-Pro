package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.ArrayAdapter
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.google.firebase.auth.FirebaseAuth

class BusinessProfileActivity : Activity() {

    private val purple = Color.rgb(111, 66, 193)
    private val dark = Color.rgb(40, 35, 55)
    private val background = Color.rgb(248, 246, 252)

    private val manager = BusinessProfileManager()

    private lateinit var container: LinearLayout
    private lateinit var nameInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var addressInput: EditText
    private lateinit var descriptionInput: EditText
    private lateinit var categorySpinner: Spinner
    private lateinit var bookingSwitch: Switch
    private lateinit var slugText: TextView
    private lateinit var saveButton: Button

    private var profileExists = false
    private var loadingProfile = false

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

        if (FirebaseAuth.getInstance().currentUser == null) {
            AlertDialog.Builder(this)
                .setTitle("Sign in required")
                .setMessage(
                    "Please sign in through Cloud Account " +
                    "& Backup before creating your business profile."
                )
                .setPositiveButton("OK") { _, _ -> finish() }
                .setCancelable(false)
                .show()
            return
        }

        buildScreen()
        loadProfile()
    }

    private fun buildScreen() {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(background)
            fillViewport = true
        }

        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 40, 32, 48)
        }

        scroll.addView(container)
        setContentView(scroll)

        addTitle("Business Profile")

        addText(
            "Set up your salon or beauty business. " +
            "These details will be used when we launch " +
            "your customer booking page."
        )

        nameInput = addInput("Business name", false)
        phoneInput = addInput("Business telephone", false)
        addressInput = addInput("Business address", true)
        descriptionInput = addInput("Business description", true)

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
            "Your booking identifier will become part " +
            "of your public booking address. " +
            "The website is not live yet."
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
            "Online booking activation will become " +
            "available once the public booking website " +
            "and security checks are completed."
        )

        saveButton = addButton("Save Business Profile") {
            saveProfile()
        }

        addButton("Back to Dashboard") {
            finish()
        }

        addText("SalonBook Pro | Phase 7A", 12f)
    }

    private fun addTitle(value: String) {
        container.addView(TextView(this).apply {
            text = value
            textSize = 27f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(purple)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
        })
    }

    private fun addText(
        value: String,
        size: Float = 16f
    ) {
        container.addView(TextView(this).apply {
            text = value
            textSize = size
            setTextColor(dark)
            setPadding(8, 12, 8, 12)
        })
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
                singleLine = true
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

    private fun loadProfile() {
        loadingProfile = true
        saveButton.isEnabled = false

        manager.loadProfile { result ->
            runOnUiThread {
                loadingProfile = false
                saveButton.isEnabled = true

                result.onSuccess { profile ->
                    if (profile == null) {
                        profileExists = false
                        return@onSuccess
                    }

                    profileExists = true

                    nameInput.setText(profile.name)
                    phoneInput.setText(profile.phone)
                    addressInput.setText(profile.address)
                    descriptionInput.setText(profile.description)

                    val categoryIndex =
                        categories.indexOf(profile.category)

                    if (categoryIndex >= 0) {
                        categorySpinner.setSelection(categoryIndex)
                    }

                    slugText.text =
                        "Booking ID: ${profile.slug}"

                    bookingSwitch.isChecked =
                        profile.acceptingBookings
                }

                result.onFailure { error ->
                    showMessage(
                        "Unable to load profile: " +
                        (error.localizedMessage ?: "Unknown error")
                    )
                }
            }
        }
    }

    private fun saveProfile() {
        if (loadingProfile) return

        val name = nameInput.text.toString().trim()
        val phone = phoneInput.text.toString().trim()
        val address = addressInput.text.toString().trim()
        val description =
            descriptionInput.text.toString().trim()

        if (name.length < 3) {
            nameInput.error = "Enter a business name"
            return
        }

        val category =
            categories[categorySpinner.selectedItemPosition]

        saveButton.isEnabled = false
        saveButton.text = "Saving..."

        manager.saveProfile(
            name = name,
            category = category,
            phone = phone,
            address = address,
            description = description
        ) { result ->
            runOnUiThread {
                saveButton.isEnabled = true
                saveButton.text = "Save Business Profile"

                result.onSuccess { profile ->
                    profileExists = true
                    slugText.text =
                        "Booking ID: ${profile.slug}"

                    showMessage(
                        "Business profile saved successfully"
                    )
                }

                result.onFailure { error ->
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

    private fun showMessage(message: String) {
        Toast.makeText(
            this,
            message,
            Toast.LENGTH_LONG
        ).show()
    }
}

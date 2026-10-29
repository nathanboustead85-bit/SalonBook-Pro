package com.salonbook.pro

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private val purple = Color.rgb(111, 66, 193)
    private val dark = Color.rgb(35, 30, 50)
    private val white = Color.WHITE

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showHomeScreen()
    }

    private fun showHomeScreen() {

        val scrollView = ScrollView(this)
        scrollView.setBackgroundColor(
            Color.rgb(248, 246, 252)
        )

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(40, 70, 40, 40)
        }

        val title = TextView(this).apply {
            text = "SalonBook Pro"
            textSize = 32f
            setTextColor(purple)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }

        layout.addView(title)

        val subtitle = TextView(this).apply {
            text = "Your Beauty Business. Simplified."
            textSize = 16f
            setTextColor(dark)
            gravity = Gravity.CENTER
            setPadding(0, 15, 0, 55)
        }

        layout.addView(subtitle)

        addMenuButton(layout, "Appointments") {
            showMessage("Appointments coming soon")
        }

        addMenuButton(layout, "Calendar") {
            showMessage("Calendar coming soon")
        }

        addMenuButton(layout, "Clients") {
            showMessage("Client management coming soon")
        }

        addMenuButton(layout, "Services & Prices") {
            showMessage("Services coming soon")
        }

        addMenuButton(layout, "Staff Management") {
            showMessage("Staff management coming soon")
        }

        addMenuButton(layout, "My Booking Link") {
            showMessage("Online booking coming soon")
        }

        addMenuButton(layout, "Business Settings") {
            showMessage("Settings coming soon")
        }

        val footer = TextView(this).apply {
            text = "SalonBook Pro | Version 0.1.0"
            textSize = 12f
            setTextColor(Color.GRAY)
            gravity = Gravity.CENTER
            setPadding(0, 50, 0, 20)
        }

        layout.addView(footer)

        scrollView.addView(layout)
        setContentView(scrollView)
    }

    private fun addMenuButton(
        parent: LinearLayout,
        label: String,
        action: () -> Unit
    ) {

        val button = Button(this).apply {
            text = label
            textSize = 16f
            isAllCaps = false
            setTextColor(white)
            setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(
                    purple
                )
            )
            setOnClickListener {
                action()
            }
        }

        val params = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = 18
        }

        parent.addView(button, params)
    }

    private fun showMessage(message: String) {
        Toast.makeText(
            this,
            message,
            Toast.LENGTH_SHORT
        ).show()
    }
}

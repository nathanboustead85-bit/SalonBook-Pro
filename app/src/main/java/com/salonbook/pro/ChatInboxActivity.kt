package com.salonbook.pro

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

/**
 * Phase 9E.2: owner-only, read-only inbox.
 * Customer messages and replies will be enabled only after secure backend deployment.
 */
class ChatInboxActivity : Activity() {
    private val teal = Color.rgb(0, 140, 149)
    private var subscription: ListenerRegistration? = null
    private lateinit var list: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = teal
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 32, 24, 24)
            setBackgroundColor(Color.rgb(250, 249, 247))
        }
        val heading = TextView(this).apply {
            text = "Boustio Messages"
            textSize = 26f
            setTextColor(teal)
        }
        root.addView(heading)
        root.addView(TextView(this).apply {
            text = "Private business inbox • read-only preview"
            textSize = 15f
            setPadding(0, 12, 0, 24)
        })
        root.addView(Button(this).apply {
            text = "Back to dashboard"
            setOnClickListener { finish() }
        })
        val scroll = ScrollView(this)
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll.addView(list)
        root.addView(scroll, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        setContentView(root)
        refresh()
    }

    private fun showMessage(message: String) {
        list.removeAllViews()
        list.addView(TextView(this).apply {
            text = message
            textSize = 16f
            setPadding(4, 24, 4, 24)
        })
    }

    private fun refresh() {
        subscription?.remove()
        subscription = null
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null || !user.isEmailVerified) {
            showMessage("Sign in with a verified business account through Cloud Account first.")
            return
        }
        showMessage("Loading conversations…")
        subscription = FirebaseFirestore.getInstance()
            .collection("businesses").document(user.uid)
            .collection("conversations")
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (isFinishing || isDestroyed) return@addSnapshotListener
                if (error != null) {
                    showMessage("Unable to load inbox: ${error.localizedMessage}. " +
                        "Chat security rules may still need publishing.")
                    return@addSnapshotListener
                }
                val documents = snapshot?.documents.orEmpty()
                if (documents.isEmpty()) {
                    showMessage("No conversations yet. Customer messaging will be available " +
                        "after the secure chat backend and website chat are deployed.")
                    return@addSnapshotListener
                }
                list.removeAllViews()
                documents.forEach { document ->
                    val name = document.getString("customerName")
                        ?.take(150)?.ifBlank { "Customer" } ?: "Customer"
                    val preview = document.getString("lastMessage")
                        ?.take(180).orEmpty()
                    list.addView(TextView(this).apply {
                        text = "$name\n$preview"
                        textSize = 17f
                        setPadding(12, 22, 12, 22)
                        setTextColor(Color.rgb(32, 36, 43))
                    })
                }
            }
    }

    override fun onDestroy() {
        subscription?.remove()
        subscription = null
        super.onDestroy()
    }
}

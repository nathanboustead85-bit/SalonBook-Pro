package com.salonbook.pro

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.functions.FirebaseFunctions

/**
 * Phase 9E.4: verified-owner live inbox and secure reply UI.
 * Reply callable must be deployed separately before sending works.
 */
class ChatInboxActivity : Activity() {
    private val teal = Color.rgb(0, 140, 149)
    private var inboxListener: ListenerRegistration? = null
    private var messageListener: ListenerRegistration? = null
    private lateinit var list: LinearLayout
    private var businessId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = teal
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 32, 24, 24)
            setBackgroundColor(Color.rgb(250, 249, 247))
        }
        root.addView(TextView(this).apply {
            text = "Boustio Messages"
            textSize = 26f
            setTextColor(teal)
        })
        root.addView(TextView(this).apply {
            text = "Private business inbox"
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
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null || !user.isEmailVerified) {
            showMessage("Sign in with a verified business account through Cloud Account first.")
        } else {
            businessId = user.uid
            loadInbox(user.uid)
        }
    }

    private fun showMessage(message: String) {
        list.removeAllViews()
        list.addView(TextView(this).apply {
            text = message
            textSize = 16f
            setPadding(4, 24, 4, 24)
        })
    }

    private fun loadInbox(uid: String) {
        messageListener?.remove()
        inboxListener?.remove()
        showMessage("Loading conversations…")
        inboxListener = FirebaseFirestore.getInstance()
            .collection("businesses").document(uid)
            .collection("conversations").limit(50)
            .addSnapshotListener { snapshot, error ->
                if (isFinishing || isDestroyed || businessId != uid) return@addSnapshotListener
                if (error != null) {
                    showMessage("Unable to load inbox: ${error.localizedMessage}")
                    return@addSnapshotListener
                }
                val documents = snapshot?.documents.orEmpty()
                if (documents.isEmpty()) {
                    showMessage("No conversations yet. Customer website chat is not live yet.")
                    return@addSnapshotListener
                }
                list.removeAllViews()
                documents.forEach { doc ->
                    val name = doc.getString("customerName")
                        ?.take(150)?.ifBlank { "Customer" } ?: "Customer"
                    val preview = doc.getString("lastMessage")?.take(180).orEmpty()
                    list.addView(Button(this).apply {
                        text = "$name\n$preview"
                        isAllCaps = false
                        setOnClickListener { openConversation(uid, doc.id, name) }
                    })
                }
            }
    }

    private fun openConversation(uid: String, id: String, name: String) {
        inboxListener?.remove()
        inboxListener = null
        messageListener?.remove()
        showMessage("Loading messages for $name…")
        val back = Button(this).apply {
            text = "Back to conversations"
            setOnClickListener {
                messageListener?.remove()
                messageListener = null
                loadInbox(uid)
            }
        }
        list.addView(back)
        val history = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        list.addView(history)
        val compose = EditText(this).apply {
            hint = "Write a reply (up to 2,000 characters)"
            maxLines = 5
        }
        list.addView(compose)
        val send = Button(this).apply { text = "Send reply" }
        list.addView(send)

        messageListener = FirebaseFirestore.getInstance()
            .collection("businesses").document(uid)
            .collection("conversations").document(id)
            .collection("messages")
            .orderBy("createdAt")
            .limitToLast(100)
            .addSnapshotListener { snapshot, error ->
                if (isFinishing || isDestroyed || businessId != uid) return@addSnapshotListener
                history.removeAllViews()
                if (error != null) {
                    history.addView(TextView(this).apply {
                        text = "Unable to load messages: ${error.localizedMessage}"
                    })
                } else {
                    snapshot?.documents.orEmpty().forEach { doc ->
                        val sender = if (doc.getString("senderType") == "business")
                            "Business" else "Customer"
                        history.addView(TextView(this).apply {
                            text = "$sender: ${doc.getString("text").orEmpty().take(2000)}"
                            textSize = 16f
                            setPadding(4, 12, 4, 12)
                        })
                    }
                }
            }

        send.setOnClickListener {
            val message = compose.text.toString().trim()
            if (message.isEmpty() || message.length > 2000) {
                AlertDialog.Builder(this).setMessage("Enter a message of 1–2,000 characters.")
                    .setPositiveButton("OK", null).show()
                return@setOnClickListener
            }
            if (FirebaseAuth.getInstance().currentUser?.uid != uid) {
                AlertDialog.Builder(this).setMessage("Business account changed. Reopen the inbox.")
                    .setPositiveButton("OK", null).show()
                return@setOnClickListener
            }
            send.isEnabled = false
            FirebaseFunctions.getInstance("europe-west2")
                .getHttpsCallable("sendBusinessChatReply")
                .call(mapOf("conversationId" to id, "message" to message))
                .addOnSuccessListener {
                    compose.setText("")
                    send.isEnabled = true
                }
                .addOnFailureListener { error ->
                    send.isEnabled = true
                    AlertDialog.Builder(this)
                        .setTitle("Reply not sent")
                        .setMessage(error.localizedMessage ?: "The messaging backend is not available yet.")
                        .setPositiveButton("OK", null).show()
                }
        }
    }

    override fun onDestroy() {
        inboxListener?.remove()
        messageListener?.remove()
        super.onDestroy()
    }
}

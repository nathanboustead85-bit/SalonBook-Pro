package com.salonbook.pro.debug

import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

/**
 * Development-only owner calendar session. No persistent tokens, no production
 * endpoint. A local emulator host must be connected through adb reverse.
 */
class UnifiedCalendarSession {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val generation = AtomicLong()
    private var running = false
    private var businessId: String? = null
    private var ownerToken: String? = null
    private var date: String? = null
    private var listener: ((State) -> Unit)? = null

    data class State(
        val connected: Boolean,
        val message: String,
        val appointments: List<EmulatorCalendarFeed.Appointment> = emptyList()
    )

    fun start(id: String, token: String, selectedDate: String, onUpdate: (State) -> Unit) {
        stop()
        businessId = id
        ownerToken = token
        date = selectedDate
        listener = onUpdate
        running = true
        val current = generation.incrementAndGet()
        poll(current)
    }

    fun changeDate(selectedDate: String) {
        if (!running) return
        date = selectedDate
        val current = generation.incrementAndGet()
        poll(current)
    }

    fun stop() {
        running = false
        generation.incrementAndGet()
        main.removeCallbacksAndMessages(null)
        businessId = null
        ownerToken = null
        date = null
        listener = null
    }

    private fun poll(current: Long) {
        if (!running || generation.get() != current) return
        val id = businessId ?: return
        val token = ownerToken ?: return
        val day = date ?: return
        worker.execute {
            val state = try {
                val snapshot = EmulatorCalendarFeed.fetch(id, token, day)
                State(true, "Emulator connected • ${snapshot.appointments.size} bookings", snapshot.appointments)
            } catch (_: Exception) {
                State(false, "Local emulator unavailable — retrying")
            }
            main.post {
                if (!running || generation.get() != current) return@post
                listener?.invoke(state)
                main.postDelayed({ poll(current) }, 5000)
            }
        }
    }
}

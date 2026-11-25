package com.salonbook.pro

import java.security.MessageDigest

/** In-memory simulation only; never connect this interface to a live provider. */
internal class CancellationWhatsAppPreview(private val provider: SimulatedProvider) {
    enum class Outcome { ACCEPTED, REJECTED, UNAVAILABLE, UNKNOWN, DUPLICATE, INVALID, CAPACITY }
    enum class Response { ACCEPTED, REJECTED, UNAVAILABLE }
    data class Envelope(val key: String, val recipient: String, val body: String)
    fun interface SimulatedProvider { fun simulate(envelope: Envelope): Response }
    private val lock = Any()
    private val attempts = mutableMapOf<String,Outcome>()
    fun attempt(snapshot: SecureReminderPlan.Snapshot?, owner: String?, requested: String?,
                business: CancellationMessageTemplate.Business, contact: CustomerCommunicationPolicy.Contact?,
                consent: NotificationPreferences.CustomerConsent?, now: Long): Outcome = synchronized(lock) {
        val message = CancellationMessageTemplate.render(snapshot,owner,requested,business,contact,consent,AppointmentCancellationPreview.Channel.WHATSAPP,now)
            ?: return@synchronized Outcome.INVALID
        val booking = snapshot?.booking ?: return@synchronized Outcome.INVALID
        val recipient = contact?.phone ?: return@synchronized Outcome.INVALID
        if (!Regex("\\+[1-9][0-9]{7,14}").matches(recipient)) return@synchronized Outcome.INVALID
        val raw = listOf(booking.businessId,booking.bookingId,booking.revision.toString(),"canceled","WHATSAPP").joinToString("") { "${it.length}:$it" }
        val key = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
        if (attempts.containsKey(key)) return@synchronized Outcome.DUPLICATE
        if (attempts.size >= 10000) return@synchronized Outcome.CAPACITY
        attempts[key] = Outcome.UNKNOWN
        val result = try {
            when(provider.simulate(Envelope(key,recipient,message.body))) {
                Response.ACCEPTED -> Outcome.ACCEPTED
                Response.REJECTED -> Outcome.REJECTED
                Response.UNAVAILABLE -> Outcome.UNAVAILABLE
            }
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            Outcome.UNKNOWN
        } catch (e: Exception) { Outcome.UNKNOWN }
        attempts[key] = result
        result
    }
}

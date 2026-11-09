package com.salonbook.pro.debug

import java.net.URI
import java.time.LocalDate

/**
 * Phase 11.16: debug-only cloud transport validation.
 * No cloud URL is configured; no network request is made by this class.
 * The production calendar remains disconnected from this prototype.
 */
internal object SecureCloudCalendarContract {
    private val demoBusiness = Regex("demo_[A-Za-z0-9_-]{3,75}")
    private val datePattern = Regex("\\d{4}-\\d{2}-\\d{2}")
    private val approvedHosts = emptySet<String>() // Explicitly empty until separate security approval.

    data class Request(val businessId: String, val date: String, val ownerToken: String)
    data class Endpoint(val uri: URI)

    fun validateRequest(businessId: String, date: String, ownerToken: String): Request {
        require(demoBusiness.matches(businessId)) { "Synthetic demo business required" }
        require(datePattern.matches(date) && LocalDate.parse(date).toString() == date) { "Invalid UK date" }
        require(ownerToken.isNotBlank() && ownerToken.length <= 8192) { "Owner authentication required" }
        return Request(businessId, date, ownerToken)
    }

    fun validateEndpoint(raw: String): Endpoint {
        val uri = URI(raw)
        require(uri.scheme == "https") { "HTTPS required" }
        require(uri.host != null && uri.host in approvedHosts) { "Unapproved cloud host" }
        require(uri.userInfo == null && uri.query == null && uri.fragment == null) { "Invalid endpoint" }
        require(uri.port == -1 || uri.port == 443) { "Invalid HTTPS port" }
        return Endpoint(uri)
    }

    fun isConfigured(): Boolean = approvedHosts.isNotEmpty()
}

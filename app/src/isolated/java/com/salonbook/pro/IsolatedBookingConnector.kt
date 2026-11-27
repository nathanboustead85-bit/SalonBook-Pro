package com.salonbook.pro

import org.json.JSONObject

// TEST flavor only. Transport and session supplied by isolated test harness.
// Never reads or modifies legacy appointment preferences.
internal class IsolatedBookingConnector(
    private val session: () -> Pair<String, String>?,
    private val transport: (String, String) -> String
) {
    fun submit(request: JSONObject): JSONObject {
        val before = session() ?: error("No test session")
        val uid = before.first
        require(request.getString("businessId") == uid)
        require(request.getString("actorId") == uid)
        val requestId = request.getString("requestId")
        val appointmentId = request.getString("appointmentId")
        val revision = request.getLong("expectedRevision")
        require(revision >= 0 && revision < Long.MAX_VALUE)
        val result = JSONObject(transport(before.second, request.toString()))
        check(session() == before) { "Session changed" }
        check(result.getInt("receiptVersion") == 1 &&
            result.getBoolean("accepted") &&
            result.getString("status") == "accepted" &&
            result.getString("businessId") == uid &&
            result.getString("actorId") == uid &&
            result.getString("requestId") == requestId &&
            result.getString("appointmentId") == appointmentId &&
            result.getLong("revision") == revision + 1) { "Invalid receipt" }
        return result
    }
}

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
        val id = Regex("[A-Za-z0-9_-]{1,128}")
        require(id.matches(uid) && id.matches(requestId) && id.matches(appointmentId))
        require(request.get("expectedRevision") is Int || request.get("expectedRevision") is Long)
        val action = request.getString("action")
        require(action in setOf("create","cancel","reschedule"))
        require(revision in 0..9007199254740990L && (if (action == "create") revision == 0L else revision > 0L))
        if (action != "cancel") {
            require(id.matches(request.getString("serviceId")) && id.matches(request.getString("staffId")))
            val date = request.getString("date")
            require(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}").matches(date))
            java.time.LocalDate.parse(date)
            require(Regex("(?:[01][0-9]|2[0-3]):(?:00|15|30|45)").matches(request.getString("startTime")))
        }
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

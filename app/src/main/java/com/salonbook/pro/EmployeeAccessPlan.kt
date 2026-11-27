package com.salonbook.pro

object EmployeeAccessPlan {
    val roles = listOf("No access", "Employee", "Receptionist", "Manager")
    fun normalise(role: String): String = role.takeIf { it in roles } ?: "No access"
    fun description(role: String): String = when (normalise(role)) {
        "Employee" -> "Own appointments and working hours only."
        "Receptionist" -> "Diary and essential booking contact details."
        "Manager" -> "Team diary, services and staff scheduling."
        else -> "No employee access planned."
    }
}

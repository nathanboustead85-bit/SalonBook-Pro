package com.salonbook.pro

internal object BusinessHubPreview {
    data class Feature(val id: String, val title: String, val description: String)
    data class Category(val title: String, val features: List<Feature>)
    val categories = listOf(
        Category("Bookings and customers", listOf(
            Feature("booking", "Online booking", "Customer booking link and availability preview"),
            Feature("customers", "Customer management", "Customer profiles and preferences preview"),
            Feature("portfolio", "Portfolios and galleries", "Staff and salon gallery preview"))),
        Category("Team and communication", listOf(
            Feature("team", "Employee access", "Role and permission preview"),
            Feature("messages", "Messages and notifications", "Chat and reminder preview"))),
        Category("Business growth", listOf(
            Feature("reports", "Financial reporting", "Employee takings and performance preview"),
            Feature("marketing", "Marketing and loyalty", "Campaigns and rewards preview"),
            Feature("intelligence", "Intelligent booking", "Waiting list, recurring bookings and recommendations preview"))),
        Category("Future services", listOf(
            Feature("payments", "Payments and tipping", "Planned payment tools — unavailable"),
            Feature("subscription", "Subscription and billing", "Planned billing tools — unavailable")))
    )
    fun find(id: String): Feature? = categories.flatMap { it.features }.singleOrNull { it.id == id }
}

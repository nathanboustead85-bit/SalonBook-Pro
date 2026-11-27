package com.salonbook.pro

internal object BusinessProfileValidation {
    fun error(values: Map<String, String>): String? {
        if (values["name"].isNullOrBlank()) return "Enter a business name."
        if (values.any { (key, value) -> value.length > (if (key == "description") 1000 else 250) }) return "Business details are too long."
        val email = values["email"].orEmpty()
        if (email.isNotEmpty() && !Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+").matches(email)) return "Enter a valid business email."
        return null
    }
}

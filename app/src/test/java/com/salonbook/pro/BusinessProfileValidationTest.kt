package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
class BusinessProfileValidationTest {
    @Test fun validProfile() { assertNull(BusinessProfileValidation.error(mapOf("name" to "Test Salon", "email" to "test@example.com"))) }
    @Test fun blankName() { assertNotNull(BusinessProfileValidation.error(mapOf("name" to " "))) }
    @Test fun invalidEmail() { assertNotNull(BusinessProfileValidation.error(mapOf("name" to "Salon", "email" to "bad"))) }
    @Test fun oversizedDescription() { assertNotNull(BusinessProfileValidation.error(mapOf("name" to "Salon", "description" to "x".repeat(1001)))) }
}

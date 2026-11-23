package com.salonbook.pro.recovery

import org.junit.Assert.*
import org.junit.Test

class RecoveryPreviewValidatorTest {
    private val bookings = """[{"id":"synthetic-1"},{"id":"synthetic-2"}]"""
    private val services = """[{"name":"Cut"}]"""
    private val staff = """[{"name":"Alex"}]"""

    private fun validate(
        version: Long? = 1L,
        b: String? = bookings,
        s: String? = services,
        t: String? = staff
    ) = RecoveryPreviewValidator.validate(version, b, s, t)

    private fun rejected(block: () -> Unit) {
        try {
            block()
            fail("Expected invalid backup to be rejected")
        } catch (expected: IllegalArgumentException) {
            // No write or restore can occur: validator has no persistence dependencies.
        }
    }

    @Test fun acceptsValidSyntheticEnvelope() {
        val snapshot = validate()
        assertEquals(2, snapshot.bookingCount)
        assertEquals(1, snapshot.serviceCount)
        assertEquals(1, snapshot.staffCount)
        assertEquals(bookings, snapshot.bookings)
    }

    @Test fun rejectsUnsupportedSchema() {
        rejected { validate(version = 2L) }
        rejected { validate(version = null) }
    }

    @Test fun rejectsCorruptAndNonArrayJson() {
        rejected { validate(b = "{broken") }
        rejected { validate(s = "{}") }
        rejected { validate(t = "null") }
    }

    @Test fun rejectsMissingFieldsAndOversizedData() {
        rejected { validate(b = null) }
        rejected { validate(s = null) }
        rejected { validate(t = null) }
        rejected { validate(b = " ".repeat(RecoveryPreviewValidator.MAX_FIELD_LENGTH + 1)) }
    }

    @Test fun rejectsDuplicateMissingAndNonObjectBookingIds() {
        rejected { validate(b = """[{"id":"duplicate"},{"id":"duplicate"}]""") }
        rejected { validate(b = """[{"id":""}]""") }
        rejected { validate(b = """[{"client":"Missing ID"}]""") }
        rejected { validate(b = """["not-an-object"]""") }
    }

    @Test fun subsequentValidPreviewUnaffectedByRejectedData() {
        rejected { validate(b = "{broken") }
        val snapshot = validate()
        assertEquals(2, snapshot.bookingCount)
        assertEquals(bookings, snapshot.bookings)
    }
}

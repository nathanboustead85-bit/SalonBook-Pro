package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

class AndroidStorageSnapshotAdapterValidationTest {
    private fun capture(bookings: String = "[{\"id\":\"synthetic-1\"},{\"id\":\"synthetic-2\"}]",
                        services: String = "[{\"name\":\"Haircut\"}]",
                        staff: String = "[{\"name\":\"Alex\"}]"): AndroidStorageSnapshotAdapter.Capture {
        val values = mapOf("bookings" to bookings, "services" to services, "staff" to staff)
        return AndroidStorageSnapshotAdapter(object : AndroidStorageSnapshotAdapter.PreferenceReader {
            override fun readString(key: String) = values[key]
        }).capture()
    }

    private fun rejected(result: AndroidStorageSnapshotAdapter.Capture) {
        assertTrue("Expected fail-closed rejection: $result", result is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun twoUniqueSyntheticAppointmentsArePreserved() {
        val result = capture()
        assertTrue(result is AndroidStorageSnapshotAdapter.Capture.Success)
        assertEquals("[{\"id\":\"synthetic-1\"},{\"id\":\"synthetic-2\"}]",
            (result as AndroidStorageSnapshotAdapter.Capture.Success).snapshot.bookings)
    }

    @Test fun duplicateBookingIdsAreRejected() =
        rejected(capture(bookings = "[{\"id\":\"same\"},{\"id\":\"same\"}]"))

    @Test fun missingBlankAndWrongTypeBookingIdsAreRejected() {
        for (raw in listOf("[{}]", "[{\"id\":\"\"}]", "[{\"id\":\"  \"}]", "[{\"id\":17}]", "[{\"id\":null}]")) {
            rejected(capture(bookings = raw))
        }
    }

    @Test fun malformedJsonAndTrailingTokensAreRejected() {
        for (raw in listOf("[{]", "[{\"id\":\"ok\"}] garbage", "[{\"id\":\"ok\"},]",
            "[{\"id\":\"ok\"}] [{\"id\":\"other\"}]")) {
            rejected(capture(bookings = raw))
        }
    }

    @Test fun nonObjectEntriesAreRejected() {
        rejected(capture(bookings = "[1]"))
        rejected(capture(services = "[null]"))
        rejected(capture(staff = "[\"Alex\"]"))
    }

    @Test fun optionalServiceAndStaffIdsAllowLegacyRecords() {
        assertTrue(capture(services = "[{\"name\":\"Cut\"}]", staff = "[{\"name\":\"Sam\"}]")
            is AndroidStorageSnapshotAdapter.Capture.Success)
    }

    @Test fun duplicatePresentServiceAndStaffIdsAreRejected() {
        rejected(capture(services = "[{\"id\":\"same\"},{\"id\":\"same\"}]"))
        rejected(capture(staff = "[{\"id\":\"same\"},{\"id\":\"same\"}]"))
    }

    @Test fun unicodeAndEmptyArraysRemainValid() {
        assertTrue(capture(bookings = "[{\"id\":\"日本語-1\",\"client\":\"José\"}]",
            services = "[]", staff = "[]") is AndroidStorageSnapshotAdapter.Capture.Success)
    }
}

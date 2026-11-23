package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

class AndroidStorageSnapshotAdapterTest {
    private val values = linkedMapOf(
        "bookings" to "[{\"id\":\"synthetic-1\"},{\"id\":\"synthetic-2\"}]",
        "services" to "[{\"name\":\"Haircut\"}]",
        "staff" to "[{\"name\":\"Alex\"}]"
    )

    private class FakePreferences(val values: MutableMap<String, String>) :
        AndroidStorageSnapshotAdapter.PreferenceReader {
        var reads = 0
        override fun readString(key: String): String? {
            reads++
            return values[key]
        }
    }

    @Test fun capturesTwoSyntheticBookingsWithoutMutation() {
        val fake = FakePreferences(values.toMutableMap())
        val before = fake.values.toMap()
        val result = AndroidStorageSnapshotAdapter(fake).capture()
        assertTrue(result is AndroidStorageSnapshotAdapter.Capture.Success)
        val snapshot = (result as AndroidStorageSnapshotAdapter.Capture.Success).snapshot
        assertEquals(values["bookings"], snapshot.bookings)
        assertEquals(values["services"], snapshot.services)
        assertEquals(values["staff"], snapshot.staff)
        assertEquals(before, fake.values)
        assertEquals(6, fake.reads)
    }

    @Test fun missingBookingKeyFailsClosed() {
        val fake = FakePreferences(values.toMutableMap().apply { remove("bookings") })
        assertTrue(AndroidStorageSnapshotAdapter(fake).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun malformedDataFailsClosed() {
        val fake = FakePreferences(values.toMutableMap().apply { put("staff", "corrupt") })
        assertTrue(AndroidStorageSnapshotAdapter(fake).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun oversizedDataFailsClosed() {
        val fake = FakePreferences(values.toMutableMap().apply { put("bookings", "[" + "x".repeat(1_000_001) + "]") })
        assertTrue(AndroidStorageSnapshotAdapter(fake).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun readExceptionFailsClosed() {
        val reader = object : AndroidStorageSnapshotAdapter.PreferenceReader {
            override fun readString(key: String): String? = throw IllegalStateException("synthetic read failure")
        }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }
}

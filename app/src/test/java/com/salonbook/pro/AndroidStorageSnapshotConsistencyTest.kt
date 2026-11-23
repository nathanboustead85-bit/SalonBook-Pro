package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

class AndroidStorageSnapshotConsistencyTest {
    private val initial = linkedMapOf(
        "bookings" to "[{\"id\":\"synthetic-1\"},{\"id\":\"synthetic-2\"}]",
        "services" to "[{\"name\":\"Cut\"}]",
        "staff" to "[{\"name\":\"Sam\"}]"
    )

    private class ScriptedReader(
        private val script: (String, Int) -> String?
    ) : AndroidStorageSnapshotAdapter.PreferenceReader {
        var calls = 0
        override fun readString(key: String): String? {
            calls++
            return script(key, calls)
        }
    }

    @Test fun stableTwoPassSnapshotPreservesTwoSyntheticBookings() {
        val reader = ScriptedReader { key, _ -> initial[key] }
        val result = AndroidStorageSnapshotAdapter(reader).capture()
        assertTrue(result is AndroidStorageSnapshotAdapter.Capture.Success)
        assertEquals(initial["bookings"], (result as AndroidStorageSnapshotAdapter.Capture.Success).snapshot.bookings)
        assertEquals(6, reader.calls)
    }

    @Test fun changingBookingsBetweenPassesFailsClosed() {
        val reader = ScriptedReader { key, call ->
            if (key == "bookings" && call > 3) "[{\"id\":\"synthetic-3\"}]" else initial[key]
        }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun changingServicesBetweenPassesFailsClosed() {
        val reader = ScriptedReader { key, call ->
            if (key == "services" && call > 3) "[{\"name\":\"Colour\"}]" else initial[key]
        }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun changingStaffBetweenPassesFailsClosed() {
        val reader = ScriptedReader { key, call ->
            if (key == "staff" && call > 3) "[{\"name\":\"Alex\"}]" else initial[key]
        }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun missingKeyOnSecondPassFailsClosed() {
        val reader = ScriptedReader { key, call -> if (key == "bookings" && call > 3) null else initial[key] }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun secondPassReadExceptionFailsClosed() {
        val reader = ScriptedReader { key, call ->
            if (call == 5) throw IllegalStateException("synthetic interruption")
            initial[key]
        }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun invalidSecondPassDataFailsClosed() {
        val reader = ScriptedReader { key, call ->
            if (key == "bookings" && call > 3) "[{\"id\":\"duplicate\"},{\"id\":\"duplicate\"}]" else initial[key]
        }
        assertTrue(AndroidStorageSnapshotAdapter(reader).capture() is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun noWritesAreExposedByReaderInterface() {
        assertEquals(listOf("readString"), AndroidStorageSnapshotAdapter.PreferenceReader::class.java.declaredMethods.map { it.name }.sorted())
    }
}

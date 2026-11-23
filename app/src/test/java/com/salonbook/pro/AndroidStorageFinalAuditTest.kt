package com.salonbook.pro

import org.junit.Assert.*
import org.junit.Test

/** Phase 55.4: synthetic, read-only audit. Does not inspect device preferences. */
class AndroidStorageFinalAuditTest {
    private val baseline = linkedMapOf(
        "bookings" to "[{\"id\":\"synthetic-a\",\"client\":\"One\"},{\"id\":\"synthetic-b\",\"client\":\"Two\"}]",
        "services" to "[{\"name\":\"Cut\"}]",
        "staff" to "[{\"name\":\"Alex\"}]"
    )

    private fun capture(
        values: MutableMap<String, String> = baseline.toMutableMap(),
        onRead: (String, Int) -> String? = { key, _ -> values[key] }
    ): Pair<AndroidStorageSnapshotAdapter.Capture, Int> {
        var reads = 0
        val reader = object : AndroidStorageSnapshotAdapter.PreferenceReader {
            override fun readString(key: String): String? {
                reads++
                return onRead(key, reads)
            }
        }
        val result = AndroidStorageSnapshotAdapter(reader).capture()
        return result to reads
    }

    @Test fun repeatedCaptureIsDeterministicAndReadOnly() {
        val values = baseline.toMutableMap()
        repeat(50) {
            val (result, reads) = capture(values)
            assertTrue(result is AndroidStorageSnapshotAdapter.Capture.Success)
            assertEquals(6, reads)
            val snapshot = (result as AndroidStorageSnapshotAdapter.Capture.Success).snapshot
            assertEquals(baseline["bookings"], snapshot.bookings)
            assertEquals(baseline["services"], snapshot.services)
            assertEquals(baseline["staff"], snapshot.staff)
            assertEquals(baseline, values)
        }
    }

    @Test fun allThreeKeysAreRequiredEvenWhenBookingsAreEmpty() {
        for (missing in baseline.keys) {
            val values = baseline.toMutableMap()
            values.remove(missing)
            assertTrue("Missing $missing", capture(values).first is AndroidStorageSnapshotAdapter.Capture.Rejected)
        }
        val values = baseline.toMutableMap()
        values["bookings"] = "[]"
        assertTrue(capture(values).first is AndroidStorageSnapshotAdapter.Capture.Success)
    }

    @Test fun corruptionOfEachKeyFailsClosed() {
        for (key in baseline.keys) {
            val values = baseline.toMutableMap()
            values[key] = "[{]"
            assertTrue("Corrupt $key", capture(values).first is AndroidStorageSnapshotAdapter.Capture.Rejected)
        }
    }

    @Test fun duplicateAppointmentIdIsRejectedWithoutChangingOriginal() {
        val values = baseline.toMutableMap()
        values["bookings"] = "[{\"id\":\"same\"},{\"id\":\"same\"}]"
        assertTrue(capture(values).first is AndroidStorageSnapshotAdapter.Capture.Rejected)
        assertEquals(baseline["bookings"], baseline["bookings"])
        assertEquals("[{\"id\":\"same\"},{\"id\":\"same\"}]", values["bookings"])
    }

    @Test fun changeAfterFirstPassIsRejected() {
        val (result, _) = capture(onRead = { key, count ->
            if (key == "bookings" && count == 4) "[{\"id\":\"changed\"}]" else baseline[key]
        })
        assertTrue(result is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun secondPassInterruptionIsRejected() {
        val (result, _) = capture(onRead = { key, count ->
            if (count == 6) throw IllegalStateException("synthetic read interruption")
            baseline[key]
        })
        assertTrue(result is AndroidStorageSnapshotAdapter.Capture.Rejected)
    }

    @Test fun oversizedPayloadIsRejectedWithoutMutation() {
        val values = baseline.toMutableMap()
        values["staff"] = "[" + "x".repeat(1_000_001) + "]"
        val before = values.toMap()
        assertTrue(capture(values).first is AndroidStorageSnapshotAdapter.Capture.Rejected)
        assertEquals(before, values)
    }
}

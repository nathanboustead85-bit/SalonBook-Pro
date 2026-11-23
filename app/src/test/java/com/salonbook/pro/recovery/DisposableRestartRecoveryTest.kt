package com.salonbook.pro.recovery

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Disposable JVM file fixtures ONLY. Does not access Android SharedPreferences,
 * Firebase, real devices or customer bookings.
 */
class DisposableRestartRecoveryTest {
    private val originalBookings = """[{"id":"synthetic-original-1"},{"id":"synthetic-original-2"}]"""
    private val restoredBookings = """[{"id":"synthetic-restored-1"}]"""
    private val services = """[{"name":"Synthetic Cut"}]"""
    private val staff = """[{"name":"Synthetic Staff"}]"""

    private fun envelope(bookings: String = restoredBookings): String =
        org.json.JSONObject()
            .put("schemaVersion", 1)
            .put("bookings", bookings)
            .put("services", services)
            .put("staff", staff)
            .toString()

    private fun initialState(): String = envelope(originalBookings)

    private fun parseAndValidate(raw: String): RecoveryPreviewValidator.Snapshot {
        val obj = org.json.JSONObject(raw)
        return RecoveryPreviewValidator.validate(
            obj.getLong("schemaVersion"),
            obj.getString("bookings"),
            obj.getString("services"),
            obj.getString("staff")
        )
    }

    private fun disposableTest(block: (File) -> Unit) {
        val dir = Files.createTempDirectory("boustio-58-5-synthetic-").toFile()
        val file = File(dir, "synthetic-state.json")
        file.writeText(initialState())
        try {
            block(file)
        } finally {
            dir.deleteRecursively()
        }
    }

    /**
     * This is a disposable file simulation, NOT Android's persistence mechanism.
     * Reject invalid incoming data before writing a staging file.
     */
    private fun simulatedRestore(file: File, incoming: String, interruptBeforeCommit: Boolean = false) {
        parseAndValidate(incoming)
        val staging = File(file.parentFile, "synthetic-state.pending")
        check(!staging.exists()) { "Stale pending fixture" }
        try {
            staging.writeText(incoming)
            if (interruptBeforeCommit) throw IllegalStateException("Synthetic process interruption")
            Files.move(
                staging.toPath(), file.toPath(),
                StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE
            )
        } finally {
            staging.delete()
        }
    }

    @Test fun restartReloadsOriginalSyntheticAppointments() = disposableTest { file ->
        val firstSession = parseAndValidate(file.readText())
        val secondSession = parseAndValidate(file.readText()) // independent read, simulates restart
        assertEquals(2, firstSession.bookingCount)
        assertEquals(firstSession.bookings, secondSession.bookings)
    }

    @Test fun interruptedRestoreRetainsOriginalAppointmentsAcrossRestart() = disposableTest { file ->
        try {
            simulatedRestore(file, envelope(), interruptBeforeCommit = true)
            fail("Expected synthetic interruption")
        } catch (expected: IllegalStateException) {
            assertEquals("Synthetic process interruption", expected.message)
        }
        val afterRestart = parseAndValidate(file.readText())
        assertEquals(originalBookings, afterRestart.bookings)
        assertFalse(File(file.parentFile, "synthetic-state.pending").exists())
    }

    @Test fun invalidBackupCannotOverwriteSyntheticState() = disposableTest { file ->
        try {
            simulatedRestore(file, envelope("""[{"id":"duplicate"},{"id":"duplicate"}]"""))
            fail("Expected duplicate rejection")
        } catch (expected: IllegalArgumentException) {
            assertTrue(expected.message!!.contains("duplicate"))
        }
        assertEquals(originalBookings, parseAndValidate(file.readText()).bookings)
    }

    @Test fun completedRestorePersistsAfterSimulatedRestart() = disposableTest { file ->
        simulatedRestore(file, envelope())
        val afterRestart = parseAndValidate(file.readText())
        assertEquals(1, afterRestart.bookingCount)
        assertEquals(restoredBookings, afterRestart.bookings)
    }

    @Test fun repeatedValidationNeverMutatesOriginalState() = disposableTest { file ->
        repeat(5) { parseAndValidate(envelope()) }
        assertEquals(originalBookings, parseAndValidate(file.readText()).bookings)
    }
}

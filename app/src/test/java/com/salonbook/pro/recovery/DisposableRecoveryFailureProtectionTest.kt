package com.salonbook.pro.recovery

import android.content.Context
import android.content.SharedPreferences
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.UUID

/**
 * Synthetic Android API simulation. This test fixture NEVER uses salonbook_data,
 * never accesses customer appointments, and is NOT wired into CloudActivity.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class DisposableRecoveryFailureProtectionTest {
    private lateinit var context: Context
    private lateinit var name: String
    private lateinit var prefs: SharedPreferences
    private val originalBookings = """[{"id":"synthetic-original-a"},{"id":"synthetic-original-b"}]"""
    private val originalServices = """[{"name":"Original Synthetic Service"}]"""
    private val originalStaff = """[{"name":"Original Synthetic Staff"}]"""
    private val newBookings = """[{"id":"synthetic-new"}]"""
    private val newServices = """[{"name":"New Synthetic Service"}]"""
    private val newStaff = """[{"name":"New Synthetic Staff"}]"""

    @Before fun setUp() {
        context = RuntimeEnvironment.getApplication()
        name = "boustio_58_7_disposable_" + UUID.randomUUID()
        prefs = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertTrue(prefs.edit().putString("bookings", originalBookings)
            .putString("services", originalServices)
            .putString("staff", originalStaff).commit())
    }

    @After fun tearDown() { context.deleteSharedPreferences(name) }

    private fun snapshot(): Map<String, *> = prefs.all.toMap()

    /**
     * Demonstration-only one-editor synthetic replacement, not a production restore API.
     * All fields are validated before the first write; commit() is checked.
     */
    private fun simulateRestore(bookings: String?, services: String? = newServices,
                                staff: String? = newStaff, failBeforeCommit: Boolean = false) {
        val validated = RecoveryPreviewValidator.validate(1L, bookings, services, staff)
        if (failBeforeCommit) throw IllegalStateException("Injected pre-commit failure")
        check(prefs.edit().putString("bookings", validated.bookings)
            .putString("services", validated.services)
            .putString("staff", validated.staff).commit()) { "Synthetic commit failed" }
    }

    @Test fun malformedBookingJsonPreservesEveryField() {
        val before = snapshot()
        assertThrows(IllegalArgumentException::class.java) {
            simulateRestore("[invalid")
        }
        assertEquals(before, snapshot())
    }

    @Test fun duplicateBookingIdsPreserveEveryField() {
        val before = snapshot()
        assertThrows(IllegalArgumentException::class.java) {
            simulateRestore("""[{"id":"same"},{"id":"same"}]""")
        }
        assertEquals(before, snapshot())
    }

    @Test fun missingStaffPayloadPreservesEveryField() {
        val before = snapshot()
        assertThrows(IllegalArgumentException::class.java) {
            simulateRestore(newBookings, staff = null)
        }
        assertEquals(before, snapshot())
    }

    @Test fun oversizedServicesPayloadPreservesEveryField() {
        val before = snapshot()
        assertThrows(IllegalArgumentException::class.java) {
            simulateRestore(newBookings, services = "x".repeat(RecoveryPreviewValidator.MAX_FIELD_LENGTH + 1))
        }
        assertEquals(before, snapshot())
    }

    @Test fun preCommitFailurePreservesEveryFieldAcrossFreshHandle() {
        val before = snapshot()
        assertThrows(IllegalStateException::class.java) {
            simulateRestore(newBookings, failBeforeCommit = true)
        }
        val freshHandle = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertEquals(before, freshHandle.all)
    }

    @Test fun validSyntheticRestoreCommitsAllThreeFieldsTogether() {
        simulateRestore(newBookings)
        val freshHandle = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertEquals(newBookings, freshHandle.getString("bookings", null))
        assertEquals(newServices, freshHandle.getString("services", null))
        assertEquals(newStaff, freshHandle.getString("staff", null))
    }

    @Test fun invalidRetryAfterSuccessCannotOverwriteCommittedSyntheticData() {
        simulateRestore(newBookings)
        val beforeRetry = snapshot()
        assertThrows(IllegalArgumentException::class.java) {
            simulateRestore("""[{"id":""}]""")
        }
        assertEquals(beforeRetry, snapshot())
    }
}

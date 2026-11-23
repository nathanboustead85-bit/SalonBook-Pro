package com.salonbook.pro.recovery

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
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
 * Robolectric Android API 28 simulation with a UNIQUE, disposable preference name.
 * Never uses the real app's "salonbook_data" preferences.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class DisposableSharedPreferencesTest {
    private lateinit var context: Context
    private lateinit var name: String
    private lateinit var prefs: SharedPreferences
    private val original = """[{"id":"synthetic-one"},{"id":"synthetic-two"}]"""
    private val services = """[{"name":"Synthetic Service"}]"""
    private val staff = """[{"name":"Synthetic Staff"}]"""

    @Before fun setUp() {
        context = RuntimeEnvironment.getApplication()
        name = "boustio_58_6_disposable_" + UUID.randomUUID()
        prefs = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertTrue(prefs.edit().putString("bookings", original)
            .putString("services", services).putString("staff", staff).commit())
    }

    @After fun tearDown() {
        context.deleteSharedPreferences(name)
    }

    private fun validateIncoming(bookings: String) =
        RecoveryPreviewValidator.validate(1L, bookings, services, staff)

    @Test fun persistedDataIsVisibleToFreshPreferencesHandle() {
        val reopened = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertEquals(original, reopened.getString("bookings", null))
        assertEquals(2, JSONArray(reopened.getString("bookings", "[]")).length())
    }

    @Test fun invalidIncomingBackupCannotChangeExistingPreferences() {
        try {
            validateIncoming("""[{"id":"same"},{"id":"same"}]""")
            fail("Duplicate booking IDs should be rejected")
        } catch (expected: IllegalArgumentException) {
            assertEquals(original, prefs.getString("bookings", null))
        }
    }

    @Test fun previewValidationLeavesAllStoredFieldsUntouched() {
        val before = prefs.all.toMap()
        val preview = validateIncoming("""[{"id":"synthetic-new"}]""")
        assertEquals(1, preview.bookingCount)
        assertEquals(before, prefs.all)
    }

    @Test fun discardedEditorChangesDoNotReplaceOriginalData() {
        prefs.edit().putString("bookings", """[{"id":"not-committed"}]""")
        val reopened = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertEquals(original, reopened.getString("bookings", null))
    }

    @Test fun committedSyntheticUpdateIsReadableFromNewHandle() {
        val newValue = """[{"id":"synthetic-replacement"}]"""
        validateIncoming(newValue)
        assertTrue(prefs.edit().putString("bookings", newValue).commit())
        val reopened = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        assertEquals(newValue, reopened.getString("bookings", null))
    }
}

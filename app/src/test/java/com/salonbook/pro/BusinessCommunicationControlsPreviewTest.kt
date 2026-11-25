package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.Executors
import java.util.concurrent.Callable

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class BusinessCommunicationControlsPreviewTest {
    @get:Rule val folder = TemporaryFolder()
    private fun store() = BusinessCommunicationControlsPreview(folder.root)
    private val off = CommunicationPreferencesPreview.Controls()
    @Test fun restartPauseEmergencyAndIsolation() {
        val s = store()
        val initial = s.read("owner","owner")!!
        assertEquals(off,s.effective("owner","owner"))
        assertTrue(s.change("owner","owner",initial,true,false,false,false,10))
        assertEquals(CommunicationPreferencesPreview.Controls(true,false),store().effective("owner","owner"))
        assertFalse(s.change("owner","owner",initial,true,true,false,false,20))
        assertNull(s.read("other","owner"))
        assertFalse(s.change("other","owner",initial,true,true,false,false,20))
        assertEquals(off,s.effective("other","other"))
        assertTrue(s.change("owner","owner",s.read("owner","owner")!!,true,true,true,false,20))
        assertEquals(off,store().effective("owner","owner"))
        assertTrue(s.change("owner","owner",s.read("owner","owner")!!,true,true,false,true,30))
        assertEquals(off,store().effective("owner","owner"))
        assertTrue(s.change("owner","owner",s.read("owner","owner")!!,true,true,false,false,40))
        assertEquals(CommunicationPreferencesPreview.Controls(true,true),store().effective("owner","owner"))
        assertFalse(s.change("owner","owner",s.read("owner","owner")!!,false,false,false,false,39))
        folder.root.listFiles()!!.single().writeText("corrupt")
        assertNull(store().read("owner","owner"))
        assertEquals(off,store().effective("owner","owner"))
    }
    @Test fun concurrentStaleUpdates() {
        val initial = store().read("owner","owner")!!
        val pool = Executors.newFixedThreadPool(8)
        try {
            val results = pool.invokeAll(List(64) { Callable { store().change("owner","owner",initial,true,true,false,false,10) } }).map { it.get() }
            assertEquals(1,results.count { it })
        } finally { pool.shutdownNow() }
    }
}

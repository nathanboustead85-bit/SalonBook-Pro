package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.os.Bundle

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28])
class BusinessHubNavigationTest {
    private fun views(v: View): List<View> = listOf(v) + if(v is ViewGroup) (0 until v.childCount).flatMap { views(v.getChildAt(it)) } else emptyList()
    private fun click(a: MainActivity, name: String) {
        views(a.window.decorView).first { it.isClickable && it.contentDescription?.toString()==name }.performClick()
    }
    private fun has(a: MainActivity, text: String) = views(a.window.decorView).filterIsInstance<TextView>().any { it.text.toString()==text }
    @Test fun categoriesUniqueAndUnknownRejected() {
        val features=BusinessHubPreview.categories.flatMap { it.features }
        assertEquals(10,features.size)
        assertEquals(10,features.map { it.id }.distinct().size)
        assertNull(BusinessHubPreview.find("unknown"))
    }
    @Test fun hubResumeAndRecreationDoNotChangeSyntheticRecords() {
        val c=Robolectric.buildActivity(MainActivity::class.java).create().start().resume().visible()
        val a=c.get()
        val prefs=a.getSharedPreferences("salonbook_data",Context.MODE_PRIVATE)
        val records="""[{"id":"synthetic-1","client":"Demo","date":"2026-11-11","time":"09:00"},{"id":"synthetic-2","client":"Example","date":"2026-11-11","time":"11:30"}]"""
        val clients="""[{"id":"synthetic-client","name":"Demo"}]"""
        prefs.edit().putString("bookings",records).putString("client_records_v1",clients).commit()
        click(a,"Business hub")
        click(a,"Financial reporting")
        assertTrue(has(a,"ISOLATED PREVIEW — no live actions"))
        c.pause().stop().restart().start().resume()
        assertTrue(has(a,"Financial reporting"))
        val state=Bundle()
        c.pause().saveInstanceState(state).stop().destroy()
        val next=Robolectric.buildActivity(MainActivity::class.java).create(state).start().resume().visible().get()
        assertTrue(has(next,"Financial reporting"))
        click(next,"Back to business hub")
        assertTrue(has(next,"Business hub"))
        assertEquals(records,prefs.getString("bookings",null))
        assertEquals(clients,prefs.getString("client_records_v1",null))
    }
}

package uk.co.boustio.demo.phase116

/**
 * Phase 11.6 Android-side demonstration contract ONLY.
 * NOT included in the production Android app or compiled into its APK.
 *
 * A trusted emulator-only owner calendar bridge returns this JSON projection.
 * An Android calendar view can merge by booking ID, not append blindly.
 */
data class DemoCalendarAppointment(
    val id: String,
    val source: String,
    val serviceId: String,
    val staffId: String,
    val startAt: String,
    val endAt: String,
    val status: String,
    val localDate: String
)

class DemoCalendarProjection {
    private val appointments = linkedMapOf<String, DemoCalendarAppointment>()

    /** Replace the snapshot atomically; prevents duplicate UI rows on reconnect/replay. */
    fun applySnapshot(incoming: List<DemoCalendarAppointment>): List<DemoCalendarAppointment> {
        require(incoming.all { it.source == "demo_customer_web" })
        require(incoming.map { it.id }.distinct().size == incoming.size)
        appointments.clear()
        incoming.forEach { appointments[it.id] = it }
        return appointments.values.sortedWith(compareBy({ it.startAt }, { it.id }))
    }
}

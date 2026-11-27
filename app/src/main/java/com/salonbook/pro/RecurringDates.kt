package com.salonbook.pro
import java.time.LocalDate
internal object RecurringDates {
    fun generate(anchor: LocalDate, frequency: Int, count: Int): List<LocalDate> {
        require(count in 1..12 && frequency in 0..2)
        return (1..count).map { n -> when (frequency) {
            0 -> anchor.plusWeeks(n.toLong())
            1 -> anchor.plusWeeks(n.toLong() * 2)
            else -> anchor.plusMonths(n.toLong())
        } }
    }
}

package com.salonbook.pro

import java.math.BigDecimal
import java.time.LocalDate
import java.time.DayOfWeek
import java.time.temporal.TemporalAdjusters

internal object DiaryReporting {
    data class Entry(val date: String, val price: String, val staffId: String)
    data class Summary(val count: Int, val total: BigDecimal, val unknown: Int, val unassigned: Int)
    data class StaffSummary(val staffId: String, val summary: Summary)
    fun byStaff(entries: List<Entry>, today: String, period: Int): List<StaffSummary> =
        entries.groupBy { it.staffId.trim() }.map { (id, rows) -> StaffSummary(id, summarise(rows, today, period)) }
            .filter { it.summary.count > 0 }.sortedWith(compareByDescending<StaffSummary> { it.summary.total }.thenBy { it.staffId })

    fun summarise(entries: List<Entry>, today: String, period: Int): Summary {
        val date = LocalDate.parse(today)
        val start = when(period) {
            0 -> date
            1 -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            2 -> date.withDayOfMonth(1)
            3 -> date.withDayOfYear(1)
            else -> return Summary(0, BigDecimal.ZERO, 0, 0)
        }
        val end = when(period) { 0 -> start.plusDays(1); 1 -> start.plusWeeks(1); 2 -> start.plusMonths(1); else -> start.plusYears(1) }
        val selected = entries.filter { val d = runCatching { LocalDate.parse(it.date) }.getOrNull(); d != null && !d.isBefore(start) && d.isBefore(end) }
        val prices = selected.map { it.price.trim().removePrefix("£").trim().takeIf { p -> p.matches(Regex("[0-9]{1,9}(\\.[0-9]{1,2})?")) }?.toBigDecimalOrNull() }
        return Summary(selected.size, prices.filterNotNull().fold(BigDecimal.ZERO, BigDecimal::add), prices.count { it == null }, selected.count { it.staffId.isBlank() })
    }
}

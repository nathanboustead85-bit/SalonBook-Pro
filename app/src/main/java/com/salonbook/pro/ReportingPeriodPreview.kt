package com.salonbook.pro

import java.time.LocalDate
import java.time.ZoneId
import java.time.DayOfWeek
import java.time.temporal.TemporalAdjusters
import java.time.temporal.ChronoUnit
import java.math.BigDecimal
import java.math.RoundingMode

internal object ReportingPeriodPreview {
    enum class Period { DAY, WEEK, MONTH, YEAR, CUSTOM }
    data class Range(val from:Long,val until:Long)
    data class Comparison(val current:Range,val previous:Range)
    fun ranges(date:LocalDate,period:Period,zone:String="Europe/London",customEnd:LocalDate?=null):Comparison? {
        return try {
            val tz=ZoneId.of(zone)
            val start=when(period) {
                Period.DAY,Period.CUSTOM -> date
                Period.WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                Period.MONTH -> date.withDayOfMonth(1)
                Period.YEAR -> date.withDayOfYear(1)
            }
            val end=when(period) {
                Period.DAY -> start.plusDays(1)
                Period.WEEK -> start.plusWeeks(1)
                Period.MONTH -> start.plusMonths(1)
                Period.YEAR -> start.plusYears(1)
                Period.CUSTOM -> customEnd?.plusDays(1) ?: return null
            }
            val days=ChronoUnit.DAYS.between(start,end)
            if(days !in 1L..3660L) return null
            val previous=when(period) {
                Period.MONTH -> start.minusMonths(1)
                Period.YEAR -> start.minusYears(1)
                else -> start.minusDays(days)
            }
            fun millis(d:LocalDate)=d.atStartOfDay(tz).toInstant().toEpochMilli()
            val a=millis(previous);val c=millis(start);val z=millis(end)
            if(a<=0 || c<=a || z<=c) null else Comparison(Range(c,z),Range(a,c))
        } catch (_:RuntimeException) { null }
    }
    fun growthPercent(current:Long,previous:Long):BigDecimal? {
        if(current<0 || previous<=0) return null
        val base=BigDecimal.valueOf(previous)
        return BigDecimal.valueOf(current).subtract(base).multiply(BigDecimal.valueOf(100))
            .divide(base,2,RoundingMode.HALF_UP)
    }
}

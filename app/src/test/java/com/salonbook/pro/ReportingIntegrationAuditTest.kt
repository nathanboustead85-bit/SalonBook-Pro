package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class ReportingIntegrationAuditTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val range=ReportingPeriodPreview.Range(3600000,18000000)
    private val now=10800000L
    private val records=(0 until 12).map { i ->
        CustomerAppointmentHistoryPreview.Entry("b","c"+(i%4),"id"+i,3600000L+i*600000L,
            "service"+(i%2),"staff"+(i%3),1000L+i*100,
            when(i%3) {
                0 -> CustomerAppointmentHistoryPreview.Status.COMPLETED
                1 -> CustomerAppointmentHistoryPreview.Status.BOOKED
                else -> CustomerAppointmentHistoryPreview.Status.CANCELED
            })
    }
    @Test fun crossReportTotals() {
        val all=RevenueReportPreview.calculate(owner,"o","b",records,range.from,range.until,now)!!
        val staff=EmployeeReportPreview.calculate(owner,"o","b",records,range,now)!!
        val services=ServiceReportPreview.calculate(owner,"o","b",records,range,now)!!
        for(group in listOf(staff.map{it.totals},services.map{it.totals})) {
            assertEquals(all.completedValuePence,group.sumOf{it.completedValuePence})
            assertEquals(all.upcomingValuePence,group.sumOf{it.upcomingValuePence})
            assertEquals(all.canceledValuePence,group.sumOf{it.canceledValuePence})
            assertEquals(all.overdueBookedValuePence,group.sumOf{it.overdueBookedValuePence})
            assertEquals(all.completedCount,group.sumOf{it.completedCount})
            assertEquals(all.canceledCount,group.sumOf{it.canceledCount})
        }
        val retention=CustomerRetentionPreview.calculate(owner,"o","b",records,range,now,3600000)!!
        assertEquals(all.completedValuePence,retention.customers.sumOf{it.lifetimeValuePence})
        val windows=(0..2).map{OccupancyReportPreview.Window("b","staff"+it,range.from,range.until)}
        val appointments=records.map{OccupancyReportPreview.Appointment(it,it.startsAt+600000)}
        val occupancy=OccupancyReportPreview.calculate(owner,"o","b",windows,appointments,range,now,"UTC")!!
        assertEquals(all.canceledValuePence,occupancy.canceledValuePence)
        assertEquals(4800000L,occupancy.bookedMillis)
        assertEquals(occupancy.bookedMillis,occupancy.bookedByLocalHour.values.sum())
        assertEquals(occupancy.availableMillis,occupancy.bookedMillis+occupancy.unusedMillis)
        assertEquals(12,records.size)
    }
    @Test fun denyUnauthorizedAcrossReports() {
        for(role in EmployeeAccessPreview.Role.values()) {
            for(active in listOf(false,true)) {
                for(actor in listOf("o","other")) {
                    for(business in listOf("b","other")) {
                        val m=owner.copy(role=role,active=active)
                        val allowed=role==EmployeeAccessPreview.Role.OWNER && active && actor=="o" && business=="b"
                        assertEquals(allowed,RevenueReportPreview.calculate(m,actor,business,records,range.from,range.until,now)!=null)
                        assertEquals(allowed,EmployeeReportPreview.calculate(m,actor,business,records,range,now)!=null)
                        assertEquals(allowed,ServiceReportPreview.calculate(m,actor,business,records,range,now)!=null)
                        assertEquals(allowed,CustomerRetentionPreview.calculate(m,actor,business,records,range,now,3600000)!=null)
                        for(kind in GrowthExportPreview.Kind.values()) {
                            assertEquals(allowed,GrowthExportPreview.csv(m,actor,business,records,range,now,kind,true)!=null)
                            assertNull(GrowthExportPreview.csv(m,actor,business,records,range,now,kind,false))
                        }
                    }
                }
            }
        }
    }
}

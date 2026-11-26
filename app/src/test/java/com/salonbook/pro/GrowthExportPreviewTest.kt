package com.salonbook.pro

import java.time.LocalDate
import java.time.Instant
import org.junit.Test
import org.junit.Assert.*

class GrowthExportPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private fun time(s:String)=Instant.parse(s+"T00:00:00Z").toEpochMilli()
    private val now=time("2026-04-01")
    private val range=ReportingPeriodPreview.Range(time("2026-02-01"),time("2026-04-01"))
    private fun row(id:String,date:String,price:Long,business:String="b")=
        CustomerAppointmentHistoryPreview.Entry(business,"private-customer",id,time(date),"cut, \"premium\""," =1+1",price,CustomerAppointmentHistoryPreview.Status.COMPLETED)
    private val rows=listOf(row("1","2026-01-15",1000),row("2","2026-02-15",1500),row("3","2026-03-15",3000),row("4","2026-03-15",99999,"other"))
    @Test fun monthlyGrowth() {
        val result=GrowthExportPreview.trends(owner,"o","b",rows,LocalDate.parse("2026-02-15"),2,now,"UTC")!!
        assertEquals(listOf("2026-02","2026-03"),result.map{it.label})
        assertEquals(listOf("50.00","100.00"),result.map{it.growth.toString()})
        assertNull(GrowthExportPreview.trends(owner,"o","b",rows,LocalDate.parse("2026-02-15"),121,now))
    }
    @Test fun csvPrivacyAndEscaping() {
        fun export(kind:GrowthExportPreview.Kind,confirmed:Boolean=true)=GrowthExportPreview.csv(owner,"o","b",rows,range,now,kind,confirmed)
        val staff=export(GrowthExportPreview.Kind.EMPLOYEE)!!
        assertTrue(staff.contains("\"' =1+1\""))
        assertTrue(staff.contains(",2,45.00,"))
        assertFalse(staff.contains("private-customer"))
        assertTrue(export(GrowthExportPreview.Kind.SERVICE)!!.contains("\"cut, \"\"premium\"\"\""))
        assertNotNull(export(GrowthExportPreview.Kind.BUSINESS))
        assertNull(export(GrowthExportPreview.Kind.BUSINESS,false))
        assertNull(GrowthExportPreview.csv(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",rows,range,now,GrowthExportPreview.Kind.BUSINESS,true))
        assertNull(GrowthExportPreview.csv(owner,"other","b",rows,range,now,GrowthExportPreview.Kind.BUSINESS,true))
        assertNull(GrowthExportPreview.csv(owner,"o","b",rows+rows,range,now,GrowthExportPreview.Kind.BUSINESS,true))
    }
}

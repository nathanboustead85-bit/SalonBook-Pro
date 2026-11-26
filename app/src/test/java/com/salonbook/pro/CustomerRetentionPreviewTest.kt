package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class CustomerRetentionPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val range=ReportingPeriodPreview.Range(100,300)
    private val completed=CustomerAppointmentHistoryPreview.Status.COMPLETED
    private fun row(id:String,customer:String,at:Long,price:Long=100,business:String="b",status:CustomerAppointmentHistoryPreview.Status=completed)=
        CustomerAppointmentHistoryPreview.Entry(business,customer,id,at,"cut","staff",price,status)
    private fun report(rows:List<CustomerAppointmentHistoryPreview.Entry>)=CustomerRetentionPreview.calculate(owner,"o","b",rows,range,400,90)
    @Test fun cohortsAndLifetime() {
        val rows=listOf(row("1","a",50),row("2","b",60),row("3","a",100),row("4","a",150),
            row("5","c",200),row("6","d",300),row("7","other",150,business="other"),
            row("8","e",200,status=CustomerAppointmentHistoryPreview.Status.CANCELED))
        val result=report(rows)!!
        assertEquals(1,result.newCustomers)
        assertEquals(1,result.returningCustomers)
        assertEquals(2,result.priorCustomers)
        assertEquals("50.00",result.retentionPercent.toString())
        assertEquals("1.50",result.averageVisits.toString())
        assertEquals("150.00",result.averageLifetimeValuePence.toString())
        assertEquals("a",result.customers.first().customerId)
        assertEquals(300L,result.customers.first().lifetimeValuePence)
        assertEquals(listOf("b"),result.customers.filter{it.inactive}.map{it.customerId})
        assertEquals(8,rows.size)
    }
    @Test fun privacyAndInvalidData() {
        val rows=listOf(row("1","a",150))
        assertNull(CustomerRetentionPreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",rows,range,400,90))
        assertNull(CustomerRetentionPreview.calculate(owner,"other","b",rows,range,400,90))
        assertNull(report(rows+rows))
        assertNull(report(listOf(row("1","a",401))))
        assertNull(report(listOf(row("1","a",150,Long.MAX_VALUE),row("2","b",150,1))))
        assertNull(report(emptyList())!!.retentionPercent)
        assertNull(report(emptyList())!!.averageLifetimeValuePence)
        assertNull(CustomerRetentionPreview.calculate(owner,"o","b",rows,range,400,401))
    }
}

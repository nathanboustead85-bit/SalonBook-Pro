package com.salonbook.pro
import org.junit.Test
import org.junit.Assert.*

class ReferralPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val programme=ReferralPreview.Programme("b",1,true,500,1000)
    private val code=ReferralPreview.Code("b","ABCD1234EFGH","ref",100,400)
    private val ledger=ReferralPreview.Ledger("b",1,emptyList())
    private fun entry(id:String,c:String,at:Long)=CustomerAppointmentHistoryPreview.Entry("b",c,id,at,"cut","staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED)
    private val rows=listOf(entry("old","ref",50),entry("first","new",200))
    private fun qualify(p:ReferralPreview.Programme=programme,codes:List<ReferralPreview.Code> = listOf(code),
        l:ReferralPreview.Ledger=ledger,current:ReferralPreview.Ledger=l,
        records:List<CustomerAppointmentHistoryPreview.Entry> = rows,now:Long=300)=
        ReferralPreview.qualify(owner,"o","b",p,p,codes,code.code,"new","first",l,current,records,now)
    @Test fun rewardsAndReplay() {
        val result=qualify()!!
        assertEquals(500L,result.referrerPence)
        assertEquals(1000L,result.newcomerPence)
        assertEquals(2L,result.ledger.revision)
        assertTrue(ledger.claims.isEmpty())
        assertNull(qualify(l=result.ledger))
        assertNull(qualify(current=result.ledger))
        assertNull(qualify(codes=listOf(code,code)))
        assertNull(qualify(now=400))
        assertNull(qualify(p=programme.copy(enabled=false)))
    }
    @Test fun qualificationAndPrivacy() {
        assertNull(qualify(codes=listOf(code.copy(referrerId="new"))))
        assertNull(qualify(codes=listOf(code.copy(businessId="other"))))
        assertNull(qualify(records=rows+entry("earlier","new",150)))
        assertNull(qualify(records=listOf(rows[0],rows[1].copy(status=CustomerAppointmentHistoryPreview.Status.BOOKED))))
        assertNull(qualify(records=listOf(rows[1])))
        assertNull(qualify(records=rows+rows))
        assertNull(qualify(p=programme.copy(referrerPence=-1)))
        assertNull(ReferralPreview.qualify(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",programme,programme,listOf(code),code.code,"new","first",ledger,ledger,rows,300))
    }
}

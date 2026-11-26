package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*

class LoyaltyRewardPreviewTest {
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val reward=LoyaltyRewardPreview.Reward("b","r",1,true,10,LoyaltyRewardPreview.Kind.FREE_SERVICE,0,"cut",100,300)
    private val account=LoyaltyRewardPreview.Account("b","c",1,20)
    private fun redeem(r:LoyaltyRewardPreview.Reward=reward,a:LoyaltyRewardPreview.Account=account,
        current:LoyaltyRewardPreview.Account=a,now:Long=200,confirmed:Boolean=true)=
        LoyaltyRewardPreview.redeem(owner,"o","b",r,r,a,current,"c","redeem1","cut",2500,now,confirmed)
    @Test fun valuesAndDeduction() {
        val result=redeem()!!
        assertEquals(2500L,result.discountPence)
        assertEquals(10L,result.account.units)
        assertEquals(2L,result.account.revision)
        assertEquals(20L,account.units)
        assertNull(redeem(a=result.account))
        assertNull(redeem(current=result.account))
        assertEquals(500L,redeem(reward.copy(kind=LoyaltyRewardPreview.Kind.PERCENT,value=20))!!.discountPence)
        assertEquals(2500L,redeem(reward.copy(kind=LoyaltyRewardPreview.Kind.FIXED,value=3000))!!.discountPence)
    }
    @Test fun invalidAndUnauthorized() {
        assertNull(redeem(now=300))
        assertNull(redeem(now=99))
        assertNull(redeem(a=account.copy(units=9)))
        assertNull(redeem(confirmed=false))
        assertNull(redeem(reward.copy(serviceId="other")))
        assertNull(redeem(reward.copy(businessId="other")))
        assertNull(redeem(a=account.copy(customerId="other")))
        assertNull(redeem(reward.copy(kind=LoyaltyRewardPreview.Kind.PERCENT,value=101)))
        assertNull(LoyaltyRewardPreview.redeem(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",reward,reward,account,account,"c","id","cut",2500,200,true))
    }
}

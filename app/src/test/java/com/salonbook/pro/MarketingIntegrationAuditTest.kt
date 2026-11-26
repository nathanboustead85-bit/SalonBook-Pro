package com.salonbook.pro

import org.junit.Test
import org.junit.Assert.*
import java.time.*

class MarketingIntegrationAuditTest {
    private val day=86400000L
    private val now=Instant.parse("2026-11-26T12:00:00Z").toEpochMilli()
    private val owner=EmployeeAccessPreview.Membership("b","o",EmployeeAccessPreview.Role.OWNER,true,1)
    private val channel=MarketingConsentPreview.Channel.EMAIL
    private val consent=MarketingConsentPreview.Consent("b","c",channel,"c@example.com",true,1,now-1)
    private val records=listOf(CustomerAppointmentHistoryPreview.Entry("b","c","old",now-90*day,"cut","staff",2000,CustomerAppointmentHistoryPreview.Status.COMPLETED))
    @Test fun consentWithdrawalAcrossCampaigns() {
        val campaign=ReengagementPreview.Campaign("b","return",1,true,60,30,20,now-day,now+day)
        val ledger=ReengagementPreview.Ledger("b",1,emptyList())
        val birthday=BirthdayRewardPreview.Birthday("b","c",11,26)
        val offer=BirthdayRewardPreview.Offer("b",1,true,BirthdayRewardPreview.Kind.PERCENT,20,null,7)
        val claims=BirthdayRewardPreview.Ledger("b",1,emptySet())
        for(member in listOf(owner,owner.copy(active=false),owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),owner.copy(businessId="other")))
        for(fresh in listOf(consent,consent.copy(allowed=false,revision=2)))
        for(suppressed in listOf(false,true)) {
            val expected=member==owner && fresh==consent && !suppressed
            assertEquals(expected,MarketingConsentPreview.eligible(member,"o","b","c",channel,consent.recipient,consent,fresh,now,true,suppressed))
            val comeback=ReengagementPreview.propose(member,"o","b",campaign,campaign,ledger,ledger,records,"c",now,channel,consent.recipient,consent,fresh,true,suppressed)
            val reward=BirthdayRewardPreview.issue(member,"o","b",birthday,"c",offer,offer,claims,claims,now,"cut",2000,channel,consent.recipient,consent,fresh,true,suppressed)
            val audience=CustomerSegmentationPreview.audience(member,"o","b",records,listOf(CustomerSegmentationPreview.Contact("c",consent.recipient,consent,fresh,suppressed)),now,channel,null,true)
            assertEquals(expected,audience?.contains("c")==true)
            assertEquals(expected,comeback!=null)
            assertEquals(expected,reward!=null)
            if(reward!=null && comeback!=null) {
                assertEquals(400L,reward.discountPence)
                assertEquals(20,comeback.discountPercent)
                assertNull(BirthdayRewardPreview.issue(member,"o","b",birthday,"c",offer,offer,reward.ledger,reward.ledger,now,"cut",2000,channel,consent.recipient,consent,fresh,true,suppressed))
                assertNull(ReengagementPreview.propose(member,"o","b",campaign,campaign,comeback.ledger,comeback.ledger,records,"c",now,channel,consent.recipient,consent,fresh,true,suppressed))
            }
        }
        assertTrue(claims.claims.isEmpty())
        assertTrue(ledger.events.isEmpty())
    }
    @Test fun loyaltyPromotionReferralAndAggregateReconciliation() {
        val programme=LoyaltyProgrammePreview.Programme("b",1,true,LoyaltyProgrammePreview.Mode.VISITS,1,1,now-100*day)
        val balances=LoyaltyProgrammePreview.calculate(owner,"o","b",programme,programme,records,now)!!
        assertEquals(1L,balances.single().units)
        val reward=LoyaltyRewardPreview.Reward("b","reward",1,true,1,LoyaltyRewardPreview.Kind.FIXED,500,null,now-day,now+day)
        val account=LoyaltyRewardPreview.Account("b","c",1,balances.single().units)
        val redeemed=LoyaltyRewardPreview.redeem(owner,"o","b",reward,reward,account,account,"c","redemption","cut",2000,now,true)!!
        assertEquals(0L,redeemed.account.units)
        assertEquals(500L,redeemed.discountPence)
        assertNull(LoyaltyRewardPreview.redeem(owner,"o","b",reward,reward,redeemed.account,redeemed.account,"c","redemption","cut",2000,now,true))
        val promotion=PromotionPreview.Offer("b","SAVE",1,true,PromotionPreview.Kind.PERCENT,10,now-day,now+day,10)
        val uses=PromotionPreview.Ledger("b","SAVE",1,emptyList())
        val discounted=PromotionPreview.apply(owner,"o","b",promotion,promotion,uses,uses,"SAVE","next","c",2000,now,now,records,true)!!
        assertEquals(200L,discounted.discountPence)
        assertNull(PromotionPreview.apply(owner,"o","b",promotion,promotion,discounted.ledger,discounted.ledger,"SAVE","next","c",2000,now,now,records,true))
        val referral=ReferralPreview.Code("b","ABCD1234EFGH","c",now-2*day,now+day)
        val referralProgramme=ReferralPreview.Programme("b",1,true,500,500)
        val referralLedger=ReferralPreview.Ledger("b",1,emptyList())
        val history=records+records.single().copy(customerId="new",bookingId="first",startsAt=now-day)
        val qualified=ReferralPreview.qualify(owner,"o","b",referralProgramme,referralProgramme,listOf(referral),referral.code,"new","first",referralLedger,referralLedger,history,now)!!
        assertEquals(1000L,qualified.referrerPence+qualified.newcomerPence)
        assertNull(ReferralPreview.qualify(owner,"o","b",referralProgramme,referralProgramme,listOf(referral),referral.code,"new","first",qualified.ledger,qualified.ledger,history,now))
        val segments=CustomerSegmentationPreview.classify(owner,"o","b",records,now,CustomerSegmentationPreview.Criteria())!!
        assertEquals("c",segments.single().customerId)
        val events=listOf(redeemed.discountPence,discounted.discountPence,qualified.referrerPence+qualified.newcomerPence).mapIndexed{i,v->
            MarketingAnalyticsPreview.Event("b","e$i","c",listOf(MarketingAnalyticsPreview.Kind.LOYALTY,MarketingAnalyticsPreview.Kind.PROMOTION,MarketingAnalyticsPreview.Kind.REFERRAL)[i],now-day,now,"booking$i",v,2000,100)
        }
        val rows=MarketingAnalyticsPreview.calculate(owner,"o","b",events,now-2*day,now+1,now)!!
        assertEquals(1700L,rows.sumOf{it.discountPence})
        assertEquals(3,rows.sumOf{it.redeemed})
        assertNull(MarketingAnalyticsPreview.calculate(owner.copy(role=EmployeeAccessPreview.Role.EMPLOYEE),"o","b",events,now-2*day,now+1,now))
        assertEquals(0,MarketingAnalyticsPreview.calculate(owner,"o","b",events.map{it.copy(businessId="other")},now-2*day,now+1,now)!!.sumOf{it.issued})
    }
}

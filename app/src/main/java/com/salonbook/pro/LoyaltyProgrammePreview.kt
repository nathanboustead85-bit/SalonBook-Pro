package com.salonbook.pro

internal object LoyaltyProgrammePreview {
    enum class Mode { VISITS, POINTS }
    data class Programme(val businessId:String,val revision:Long,val enabled:Boolean,
        val mode:Mode,val unitsPerVisit:Int=1,val pointsPerPound:Int=1,val startsAt:Long)
    data class Credit(val bookingId:String,val units:Long)
    data class Balance(val customerId:String,val units:Long,val credits:List<Credit>)
    fun calculate(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        candidate:Programme?,current:Programme?,records:List<CustomerAppointmentHistoryPreview.Entry>,
        now:Long):List<Balance>? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            owner?.role!=EmployeeAccessPreview.Role.OWNER || candidate==null || candidate!=current ||
            candidate.businessId!=business || candidate.revision<=0 || !candidate.enabled ||
            candidate.startsAt<=0 || candidate.startsAt>now || now==Long.MAX_VALUE ||
            candidate.unitsPerVisit !in 1..100 || candidate.pointsPerPound !in 1..100) return null
        RevenueReportPreview.calculate(owner,actor,business,records,1,now+1,now) ?: return null
        val eligible=records.filter{it.businessId==business &&
            it.status==CustomerAppointmentHistoryPreview.Status.COMPLETED && it.startsAt>=candidate.startsAt}
        return eligible.groupBy{it.customerId}.map{(id,entries)->
            var total=0L
            val credits=entries.sortedBy{it.bookingId}.map{e->
                val units=when(candidate.mode) {
                    Mode.VISITS -> candidate.unitsPerVisit.toLong()
                    Mode.POINTS -> {
                        val value=java.math.BigInteger.valueOf(e.pricePence)
                            .multiply(java.math.BigInteger.valueOf(candidate.pointsPerPound.toLong()))
                            .divide(java.math.BigInteger.valueOf(100))
                        if(value>java.math.BigInteger.valueOf(Long.MAX_VALUE)) return null
                        value.toLong()
                    }
                }
                if(Long.MAX_VALUE-total<units) return null
                total+=units
                Credit(e.bookingId,units)
            }
            Balance(id,total,credits)
        }.sortedBy{it.customerId}
    }
}

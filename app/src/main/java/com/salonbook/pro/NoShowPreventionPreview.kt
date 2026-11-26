package com.salonbook.pro

internal object NoShowPreventionPreview {
    enum class Outcome { ATTENDED, MISSED, CANCELED, UNKNOWN }
    enum class Action { CONFIRMATION_REQUEST, EXTRA_REMINDER }
    data class Attendance(val businessId:String,val customerId:String,val bookingId:String,
        val appointmentAt:Long,val recordedAt:Long,val outcome:Outcome)
    data class Event(val bookingId:String,val at:Long)
    data class Ledger(val businessId:String,val revision:Long,val events:List<Event>)
    data class Proposal(val bookingId:String,val action:Action,val ledger:Ledger)
    fun propose(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,
        booking:SecureReminderPlan.Snapshot,currentBooking:SecureReminderPlan.Snapshot,
        history:List<Attendance>,currentHistory:List<Attendance>,ledger:Ledger,currentLedger:Ledger,
        consent:NotificationPreferences.CustomerConsent?,currentConsent:NotificationPreferences.CustomerConsent?,
        settings:NotificationPreferences.BusinessSettings,currentSettings:NotificationPreferences.BusinessSettings,
        alreadyConfirmed:Boolean,existingExtraReminder:Boolean,suppressed:Boolean,now:Long):Proposal? {
        val day=86400000L
        val b=booking.booking
        if(owner?.role!=EmployeeAccessPreview.Role.OWNER ||
            !EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.BUSINESS_SETTINGS) ||
            booking!=currentBooking || history!=currentHistory || ledger!=currentLedger ||
            settings!=currentSettings || consent!=currentConsent || suppressed || existingExtraReminder ||
            b.businessId!=business || ledger.businessId!=business || b.bookingId.isBlank() ||
            b.revision<=0 || !b.confirmed || b.canceled || !b.emailConsent || !b.businessEmailEnabled ||
            b.email.isNullOrBlank() || booking.customerId.isBlank() || now<=365*day ||
            booking.appointmentAtMillis<=now || booking.appointmentAtMillis-now>7*day ||
            consent==null || consent.customerId!=booking.customerId ||
            !NotificationPreferences.hasRecordedConsent(consent) ||
            (consent.consentRecordedAtMillis ?: Long.MAX_VALUE)>now ||
            ledger.revision !in 1 until Long.MAX_VALUE || ledger.events.size>=10000 ||
            ledger.events.any{it.bookingId.isBlank() || it.at<=0 || it.at>now} ||
            ledger.events.map{it.bookingId}.distinct().size!=ledger.events.size ||
            ledger.events.any{it.bookingId==b.bookingId} || history.size>10000) return null
        val scoped=history.filter{it.businessId==business}
        if(scoped.any{it.bookingId.isBlank() || it.customerId.isBlank() || it.appointmentAt<=0 ||
            it.recordedAt<it.appointmentAt || it.recordedAt>now || it.bookingId==b.bookingId} ||
            scoped.map{it.bookingId}.distinct().size!=scoped.size) return null
        val recent=scoped.filter{it.customerId==booking.customerId && it.appointmentAt>=now-180*day &&
            it.outcome in setOf(Outcome.ATTENDED,Outcome.MISSED)}
        val missed=recent.count{it.outcome==Outcome.MISSED}
        if(recent.size<3 || missed<2 || missed*3<recent.size) return null
        val action=if(!alreadyConfirmed && NotificationPreferences.eligibleForPreview(settings,consent,NotificationPreferences.ReminderType.CONFIRMATION))
            Action.CONFIRMATION_REQUEST
        else if(NotificationPreferences.eligibleForPreview(settings,consent,NotificationPreferences.ReminderType.HOURS_24))
            Action.EXTRA_REMINDER else return null
        return Proposal(b.bookingId,action,ledger.copy(revision=ledger.revision+1,events=ledger.events+Event(b.bookingId,now)))
    }
}

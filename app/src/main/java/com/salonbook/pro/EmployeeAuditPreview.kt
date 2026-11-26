package com.salonbook.pro

import java.security.MessageDigest

/** Offline audit model. Hashes detect accidental corruption, not privileged tampering. */
internal object EmployeeAuditPreview {
    enum class Action { APPOINTMENT_CREATED, APPOINTMENT_EDITED, APPOINTMENT_CANCELED, PERMISSIONS_CHANGED, INVITED, SUSPENDED, REACTIVATED, REVOKED }
    data class Event(val businessId:String,val actorId:String,val targetId:String,val action:Action,val at:Long,val sequence:Int,val previous:String,val digest:String)
    private fun id(s:String)=s.isNotBlank() && s.length<=128 && s.none { it.isWhitespace() || Character.isISOControl(it) || Character.getType(it)==Character.FORMAT.toInt() }
    private fun digest(e:Event):String {
        val fields=listOf(e.businessId,e.actorId,e.targetId,e.action.name,e.at.toString(),e.sequence.toString(),e.previous)
        return MessageDigest.getInstance("SHA-256").digest(fields.joinToString("") { "${it.length}:$it" }.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    private fun valid(business:String,events:List<Event>):Boolean {
        if(!id(business) || events.size>10000) return false
        var previous=""
        var time=0L
        for((index,e) in events.withIndex()) {
            if(e.businessId!=business || !id(e.actorId) || !id(e.targetId) || e.sequence!=index+1 ||
                e.at<=0 || e.at<time || e.previous!=previous || e.digest!=digest(e)) return false
            previous=e.digest
            time=e.at
        }
        return true
    }
    fun append(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,candidate:List<Event>,current:List<Event>,
        target:String,action:Action,now:Long):List<Event>? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.MANAGE_STAFF) ||
            actor==null || business==null || !id(actor) || !id(target) || candidate!=current ||
            !valid(business,current) || current.size>=10000 || now<=0 || now<(current.lastOrNull()?.at?:0L)) return null
        val event=Event(business,actor,target,action,now,current.size+1,current.lastOrNull()?.digest?:"","")
        return current.toList()+event.copy(digest=digest(event))
    }
    fun read(owner:EmployeeAccessPreview.Membership?,actor:String?,business:String?,events:List<Event>):List<Event>? {
        if(!EmployeeAccessPreview.allows(owner,actor,business,EmployeeAccessPreview.Permission.MANAGE_STAFF) ||
            business==null || !valid(business,events)) return null
        return events.toList()
    }
}

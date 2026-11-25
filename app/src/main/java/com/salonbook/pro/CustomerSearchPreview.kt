package com.salonbook.pro

import java.util.Locale

/** Offline search only. Production queries must enforce authenticated tenant scope server-side. */
internal object CustomerSearchPreview {
    enum class Field { ALL, NAME, EMAIL, PHONE }
    enum class Filter { ALL, HAS_EMAIL, HAS_PHONE, MISSING_CONTACT }
    data class Page(val records:List<CustomerProfilePreview.Record>,val total:Int)
    fun search(records:List<CustomerProfilePreview.Record>,owner:String?,requested:String?,query:String,
        field:Field=Field.ALL,filter:Filter=Filter.ALL,offset:Int=0,limit:Int=50):Page? {
        if(owner.isNullOrBlank() || owner!=requested || records.size>10000 || query.length>254 ||
            offset<0 || limit !in 1..100 || query.any { Character.isISOControl(it) || Character.getType(it)==Character.FORMAT.toInt() }) return null
        val scoped=records.filter { it.businessId==owner }
        if(scoped.any { CustomerProfilePreview.read(it,owner,requested,it.customerId)==null } ||
            scoped.map { it.customerId }.toSet().size!=scoped.size) return null
        val q=query.trim().lowercase(Locale.ROOT)
        val digits=q.filter { it in '0'..'9' }
        val phoneQuery=digits.isNotEmpty() && q.all { it in '0'..'9' || it in "+ ()-" }
        val matches=scoped.filter { record ->
            val email=!record.email.isNullOrBlank()
            val phone=!record.phone.isNullOrBlank()
            val allowed=when(filter) {
                Filter.ALL -> true
                Filter.HAS_EMAIL -> email
                Filter.HAS_PHONE -> phone
                Filter.MISSING_CONTACT -> !email || !phone
            }
            val nameMatch=record.name.lowercase(Locale.ROOT).contains(q)
            val emailMatch=record.email?.lowercase(Locale.ROOT)?.contains(q)==true
            val phoneMatch=phoneQuery && record.phone?.filter { it in '0'..'9' }?.contains(digits)==true
            allowed && (q.isEmpty() || when(field) {
                Field.ALL -> nameMatch || emailMatch || phoneMatch
                Field.NAME -> nameMatch
                Field.EMAIL -> emailMatch
                Field.PHONE -> phoneMatch
            })
        }.sortedWith(compareBy<CustomerProfilePreview.Record>{it.name.lowercase(Locale.ROOT)}.thenBy{it.customerId})
        return Page(matches.drop(offset).take(limit).map { it.copy() },matches.size)
    }
}

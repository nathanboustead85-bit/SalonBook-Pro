package com.salonbook.pro

/** Offline projection only; caller must supply authoritative owner and customer records in production. */
internal object CustomerProfilePreview {
    data class Record(val businessId: String, val customerId: String, val name: String, val email: String?, val phone: String?, val revision: Long)
    fun read(record: Record?, owner: String?, requested: String?, customerId: String?): Record? {
        if (record == null || owner.isNullOrBlank() || owner != requested || owner != record.businessId ||
            customerId.isNullOrBlank() || customerId != record.customerId || record.revision <= 0 ||
            record.name.isBlank()) return null
        return record.copy()
    }
}

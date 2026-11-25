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

    /** Pure edit proposal; persistence requires an authoritative atomic revision check. */
    fun edit(candidate: Record?, current: Record?, owner: String?, requested: String?, customerId: String?,
             name: String, email: String?, phone: String?): Record? {
        if (candidate != current || read(current, owner, requested, customerId) == null ||
            current == null || current.revision == Long.MAX_VALUE) return null
        fun safe(value: String) = value.none { Character.isISOControl(it) || Character.getType(it) == Character.FORMAT.toInt() }
        if (!safe(name) || email?.let { !safe(it) } == true || phone?.let { !safe(it) } == true) return null
        val n = name.trim()
        val e = email?.trim()?.takeIf { it.isNotEmpty() }
        val p = phone?.trim()?.takeIf { it.isNotEmpty() }
        if (n.isEmpty() || n.length > 120) return null
        if (e != null && (e.length > 254 || !Regex("^[^\\s@]+@[^\\s@.]+(?:\\.[^\\s@.]+)+$").matches(e))) return null
        if (p != null && (p.length > 32 || !Regex("^\\+?[0-9 ()-]+$").matches(p) || p.count { it in '0'..'9' } !in 7..15)) return null
        if (n == current.name && e == current.email && p == current.phone) return current.copy()
        return current.copy(name = n, email = e, phone = p, revision = current.revision + 1)
    }
}

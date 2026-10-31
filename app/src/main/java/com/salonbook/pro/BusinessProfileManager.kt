package com.salonbook.pro

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.Source

data class BusinessProfile(
    val businessId: String = "",
    val name: String = "",
    val slug: String = "",
    val category: String = "",
    val email: String = "",
    val phone: String = "",
    val address: String = "",
    val description: String = "",
    val acceptingBookings: Boolean = false
)

class BusinessProfileManager {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private fun verifiedUserId(): String {
        val user = auth.currentUser
            ?: error("Please sign in first")

        check(user.isEmailVerified) {
            "Please verify your email first"
        }

        return user.uid
    }

    private fun privateProfileDocument() =
        db.collection("users")
            .document(verifiedUserId())
            .collection("business")
            .document("profile")

    private fun createSlug(name: String): String {
        val slug = name
            .lowercase(java.util.Locale.ROOT)
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')

        require(slug.length in 3..50) {
            "Business name must produce a valid booking ID"
        }

        return slug
    }

    fun generateSuggestedSlug(
        businessName: String
    ): String {
        return createSlug(businessName)
    }

    fun saveProfile(
        name: String,
        category: String,
        phone: String,
        address: String,
        description: String,
        callback: (Result<BusinessProfile>) -> Unit
    ) {
        try {
            val uid = verifiedUserId()

            val cleanName = name.trim()
            val cleanCategory = category.trim()
            val cleanPhone = phone.trim()
            val cleanAddress = address.trim()
            val cleanDescription = description.trim()

            require(cleanName.length in 3..100) {
                "Enter a business name (3-100 characters)"
            }

            require(cleanCategory.isNotBlank()) {
                "Select a business category"
            }

            val profileRef = privateProfileDocument()

            profileRef.get(Source.SERVER)
                .addOnSuccessListener { existing ->
                    try {
                        val existingSlug =
                            existing.getString("slug")

                        val slug = if (
                            !existingSlug.isNullOrBlank()
                        ) {
                            existingSlug
                        } else {
                            createSlug(cleanName)
                        }

                        val profile = BusinessProfile(
                            businessId = uid,
                            name = cleanName,
                            slug = slug,
                            category = cleanCategory,
                            email = auth.currentUser
                                ?.email.orEmpty(),
                            phone = cleanPhone,
                            address = cleanAddress,
                            description = cleanDescription,
                            acceptingBookings =
                                existing.getBoolean(
                                    "acceptingBookings"
                                ) ?: false
                        )

                        val data = mapOf(
                            "businessId" to profile.businessId,
                            "name" to profile.name,
                            "slug" to profile.slug,
                            "category" to profile.category,
                            "email" to profile.email,
                            "phone" to profile.phone,
                            "address" to profile.address,
                            "description" to profile.description,
                            "acceptingBookings" to
                                profile.acceptingBookings,
                            "schemaVersion" to 1,
                            "updatedAt" to
                                FieldValue.serverTimestamp()
                        )

                        profileRef.set(data)
                            .addOnSuccessListener {
                                callback(
                                    Result.success(profile)
                                )
                            }
                            .addOnFailureListener {
                                callback(
                                    Result.failure(it)
                                )
                            }

                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                }
                .addOnFailureListener {
                    callback(Result.failure(it))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }

    fun loadProfile(
        callback: (Result<BusinessProfile?>) -> Unit
    ) {
        try {
            privateProfileDocument()
                .get(Source.SERVER)
                .addOnSuccessListener { document ->
                    try {
                        if (!document.exists()) {
                            callback(
                                Result.success(null)
                            )
                            return@addOnSuccessListener
                        }

                        val profile = BusinessProfile(
                            businessId =
                                document.getString(
                                    "businessId"
                                ).orEmpty(),
                            name =
                                document.getString(
                                    "name"
                                ).orEmpty(),
                            slug =
                                document.getString(
                                    "slug"
                                ).orEmpty(),
                            category =
                                document.getString(
                                    "category"
                                ).orEmpty(),
                            email =
                                document.getString(
                                    "email"
                                ).orEmpty(),
                            phone =
                                document.getString(
                                    "phone"
                                ).orEmpty(),
                            address =
                                document.getString(
                                    "address"
                                ).orEmpty(),
                            description =
                                document.getString(
                                    "description"
                                ).orEmpty(),
                            acceptingBookings =
                                document.getBoolean(
                                    "acceptingBookings"
                                ) ?: false
                        )

                        callback(
                            Result.success(profile)
                        )

                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                }
                .addOnFailureListener {
                    callback(Result.failure(it))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }

    fun setAcceptingBookings(
        enabled: Boolean,
        callback: (Result<Unit>) -> Unit
    ) {
        try {
            val reference = privateProfileDocument()

            reference.get(Source.SERVER)
                .addOnSuccessListener { document ->
                    if (!document.exists()) {
                        callback(
                            Result.failure(
                                IllegalStateException(
                                    "Create your business profile first"
                                )
                            )
                        )
                        return@addOnSuccessListener
                    }

                    reference.update(
                        mapOf(
                            "acceptingBookings" to enabled,
                            "updatedAt" to
                                FieldValue.serverTimestamp()
                        )
                    )
                        .addOnSuccessListener {
                            callback(
                                Result.success(Unit)
                            )
                        }
                        .addOnFailureListener {
                            callback(
                                Result.failure(it)
                            )
                        }
                }
                .addOnFailureListener {
                    callback(Result.failure(it))
                }

        } catch (e: Exception) {
            callback(Result.failure(e))
        }
    }
}


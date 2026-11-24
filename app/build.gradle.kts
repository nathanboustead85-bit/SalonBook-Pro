plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

val isolatedSigningFile = providers.environmentVariable("BOUSTIO_SIGNING_STORE_FILE").orNull
val isolatedStorePassword = providers.environmentVariable("BOUSTIO_SIGNING_STORE_PASSWORD").orNull
val isolatedKeyAlias = providers.environmentVariable("BOUSTIO_SIGNING_KEY_ALIAS").orNull
val isolatedKeyPassword = providers.environmentVariable("BOUSTIO_SIGNING_KEY_PASSWORD").orNull
val isolatedSigningReady = listOf(
    isolatedSigningFile, isolatedStorePassword, isolatedKeyAlias, isolatedKeyPassword
).all { !it.isNullOrBlank() }

android {
    signingConfigs {
        if (isolatedSigningReady) {
            create("boustioIsolatedTest") {
                storeFile = file(isolatedSigningFile!!)
                storePassword = isolatedStorePassword!!
                keyAlias = isolatedKeyAlias!!
                keyPassword = isolatedKeyPassword!!
            }
        }
    }
    namespace = "com.salonbook.pro"
    compileSdk = 35

    flavorDimensions += "environment"
    productFlavors {
        create("isolated") {
            dimension = "environment"
            applicationIdSuffix = ".isolated"
            versionNameSuffix = "-isolated-test"
            manifestPlaceholders["appDisplayName"] = "Boustio TEST"
        }
        create("standard") {
            dimension = "environment"
            manifestPlaceholders["appDisplayName"] = "SalonBook Pro"
        }
    }

    defaultConfig {
        applicationId = "com.salonbook.pro"
        minSdk = 26
        targetSdk = 35
        versionCode = 19
        versionName = "0.2.17"
    }

    buildTypes {
        getByName("debug") {
            if (isolatedSigningReady) {
                signingConfig = signingConfigs.getByName("boustioIsolatedTest")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(
        platform("com.google.firebase:firebase-bom:34.4.0")
    )

    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")

    implementation("com.google.code.gson:gson:2.11.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.robolectric:robolectric:4.13")
}

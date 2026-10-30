plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.salonbook.pro"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.salonbook.pro"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "0.4.0"
    }

    signingConfigs {
        create("salonbookRelease") {
            val keystorePath =
                System.getenv("SIGNING_KEYSTORE_PATH")

            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
                storePassword =
                    System.getenv("SIGNING_STORE_PASSWORD")
                keyAlias =
                    System.getenv("SIGNING_KEY_ALIAS")
                keyPassword =
                    System.getenv("SIGNING_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig =
                signingConfigs.getByName("salonbookRelease")
        }
    }

    compileOptions {
        sourceCompatibility =
            JavaVersion.VERSION_17
        targetCompatibility =
            JavaVersion.VERSION_17
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
}

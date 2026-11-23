plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
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
        versionCode = 3
        versionName = "0.2.1"
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

package com.salonbook.pro

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

class BoustioApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        FirebaseAppCheck.getInstance()
            .installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        // Monitoring only: do not enable Firebase API enforcement until
        // sideloaded APK token verification has been tested successfully.
        Log.i("BoustioAppCheck", "Play Integrity provider installed")
    }
}

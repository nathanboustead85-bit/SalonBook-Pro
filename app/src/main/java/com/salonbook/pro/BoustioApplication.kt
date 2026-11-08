package com.salonbook.pro

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

class BoustioApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        FirebaseAppCheck.getInstance()
            .installAppCheckProviderFactory(
                if (BuildConfig.DEV_APP_CHECK) DebugAppCheckProviderFactory.getInstance()
                else PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        // Monitoring only: do not enable Firebase API enforcement until
        // sideloaded APK token verification has been tested successfully.
        Log.i("BoustioAppCheck", if (BuildConfig.DEV_APP_CHECK) "Development App Check provider installed" else "Play Integrity provider installed")
    }
}

plugins { id("com.android.application") }
android {
 namespace = "uk.co.boustio.calendar.demo"
 compileSdk = 35
 defaultConfig {
  applicationId = "uk.co.boustio.calendar.demo"
  minSdk = 26
  targetSdk = 35
  versionCode = 1
  versionName = "11.8-demo"
 }
 buildTypes {
  getByName("release") { isMinifyEnabled = false }
 }
 compileOptions {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
 }
}

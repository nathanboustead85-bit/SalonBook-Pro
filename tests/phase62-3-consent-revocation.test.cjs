const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const prefs=fs.readFileSync('app/src/main/java/com/salonbook/pro/NotificationPreferences.kt','utf8');
const policy=fs.readFileSync('app/src/main/java/com/salonbook/pro/NotificationSafetyPolicy.kt','utf8');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
test('preview requires a recorded and nonwithdrawn consent',()=>{
 for(const s of ['if (consent == null || !hasRecordedConsent(consent)) return false','consent.consentRecordedAtMillis > 0L','consent.consentWithdrawnAtMillis == null','consent.customerId.isNotBlank()'])assert.ok(prefs.includes(s),s);
});
test('revocation disables both contact channels',()=>{
 for(const s of ['fun withdrawConsent','require(withdrawnAtMillis > 0L)','emailNotificationsAllowed = false','whatsappContactAllowed = false','consentWithdrawnAtMillis = withdrawnAtMillis'])assert.ok(prefs.includes(s),s);
});
test('no live senders; signing and package preserved',()=>{
 for(const s of ['LIVE_EMAIL_ENABLED = false','LIVE_WHATSAPP_ENABLED = false','LIVE_BOOKING_ENABLED = false'])assert.ok(policy.includes(s),s);
 for(const s of ['versionCode = 36','versionName = "0.2.34"','applicationIdSuffix = ".isolated"'])assert.ok(gradle.includes(s),s);
 for(const s of ['startActivity(','FirebaseFirestore','HttpURLConnection','wa.me/'])assert.ok(!prefs.includes(s),s);
});

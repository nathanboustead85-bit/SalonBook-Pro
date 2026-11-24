const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const pref=fs.readFileSync('app/src/main/java/com/salonbook/pro/NotificationPreferences.kt','utf8');
const policy=fs.readFileSync('app/src/main/java/com/salonbook/pro/NotificationSafetyPolicy.kt','utf8');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
test('all preferences and customer permissions default to opt-out',()=>{
 for(const key of ['emailConfirmationsEnabled','emailRemindersEnabled','reminder24HoursEnabled','reminder2HoursEnabled','manualWhatsAppRemindersEnabled','emailNotificationsAllowed','whatsappContactAllowed'])assert.ok(pref.includes(key+': Boolean = false'),key);
});
test('each preview option requires business setting and explicit customer permission',()=>{
 for(const key of ['settings.emailConfirmationsEnabled && consent.emailNotificationsAllowed','settings.emailRemindersEnabled && settings.reminder24HoursEnabled','settings.emailRemindersEnabled && settings.reminder2HoursEnabled','settings.manualWhatsAppRemindersEnabled && consent.whatsappContactAllowed','consent == null || consent.customerId.isBlank()','consent.consentRecordedAtMillis > 0L'])assert.ok(pref.includes(key),key);
});
test('no sending or live activation',()=>{
 for(const forbidden of ['startActivity(','HttpURLConnection','FirebaseFirestore','Intent.ACTION_SEND','wa.me/'])assert.ok(!pref.includes(forbidden),forbidden);
 for(const s of ['LIVE_EMAIL_ENABLED = false','LIVE_WHATSAPP_ENABLED = false','LIVE_BOOKING_ENABLED = false'])assert.ok(policy.includes(s),s);
 assert.ok(gradle.includes('versionCode = 35')&&gradle.includes('versionName = "0.2.33"')&&gradle.includes('applicationIdSuffix = ".isolated"'));
});

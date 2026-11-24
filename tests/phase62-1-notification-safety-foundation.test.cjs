const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const policy=fs.readFileSync('app/src/main/java/com/salonbook/pro/NotificationSafetyPolicy.kt','utf8');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
const design=fs.readFileSync('docs/approved-notification-design.md','utf8');
test('fail-closed delivery flags and consent/business isolation gates',()=>{
 for(const s of ['LIVE_EMAIL_ENABLED = false','LIVE_WHATSAPP_ENABLED = false','LIVE_BOOKING_ENABLED = false','if (!LIVE_EMAIL_ENABLED || snapshot == null) return false','snapshot.businessId == expectedBusinessId','snapshot.confirmed','!snapshot.canceled','snapshot.emailConsent','snapshot.businessEmailEnabled','!snapshot.email.isNullOrBlank()'])assert.ok(policy.includes(s),s);
});
test('idempotency includes business booking revision and event',()=>{
 for(const s of ['businessId.isBlank()','bookingId.isBlank()','revision <= 0L','confirmed','rescheduled','canceled','reminder-24h','reminder-2h','listOf(businessId, bookingId, revision.toString(), event)'])assert.ok(policy.includes(s),s);
});
test('no live sender or new permissions and stable isolated version',()=>{
 for(const s of ['Intent.ACTION_SEND','startActivity(','FirebaseFirestore','HttpURLConnection','https://','wa.me/'])assert.ok(!policy.includes(s),s);
 assert.ok(gradle.includes('versionCode = 34'));
 assert.ok(gradle.includes('versionName = "0.2.32"'));
 assert.ok(gradle.includes('applicationIdSuffix = ".isolated"'));
 assert.ok(design.includes('manually'));
});

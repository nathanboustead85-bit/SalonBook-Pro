'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const client=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
const workflow=fs.readFileSync('.github/workflows/boustio-phase-60-13-client-profiles.yml','utf8');
test('client profiles show structured contact details and history',()=>{
 for(const token of ['CONTACT DETAILS','CLIENT NOTES','Appointment history','No appointments recorded for this client.','Client profile','Client actions']) assert.ok(client.includes(token),token);
 assert.ok(client.includes('sortedWith(compareByDescending<JSONObject>'));
});
test('existing data keys and safe delete behavior remain intact',()=>{
 for(const token of ['client_records_v1','getSharedPreferences("salonbook_data", MODE_PRIVATE)','Client has bookings; deletion blocked'])assert.ok(client.includes(token),token);
 assert.ok(!client.includes('prefs.edit().clear()'));
});
test('version 6 retains permanent signing and isolated offline package',()=>{
 assert.match(gradle,/versionCode = 6/);
 assert.match(gradle,/applicationIdSuffix = "\.isolated"/);
 assert.ok(workflow.includes("versionCode='6'"));
 assert.ok(workflow.includes('secrets.SIGNING_KEYSTORE_BASE64'));
 assert.ok(workflow.includes('android.permission.INTERNET'));
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
const workflow=fs.readFileSync('.github/workflows/boustio-phase-60-12-in-place-update.yml','utf8');
const client=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
test('update increments version without changing isolated package',()=>{
 assert.match(gradle,/versionCode = 5/);
 assert.match(gradle,/versionName = "0\.2\.3"/);
 assert.match(gradle,/applicationIdSuffix = "\.isolated"/);
});
test('reuse existing permanent signing credentials',()=>{
 for(const secret of ['SIGNING_KEYSTORE_BASE64','SIGNING_STORE_PASSWORD','SIGNING_KEY_ALIAS','SIGNING_KEY_PASSWORD'])
 assert.ok(workflow.includes('secrets.'+secret),secret);
 assert.match(gradle,/signingConfigs.getByName\("boustioIsolatedTest"\)/);
 assert.ok(workflow.includes('needs: signing-preflight'));
 assert.ok(workflow.includes('base64 --decode'));
});
test('do not erase client records or grant isolated network access',()=>{
 assert.ok(client.includes('client_records_v1'));
 assert.ok(client.includes('getSharedPreferences("salonbook_data", MODE_PRIVATE)'));
 assert.ok(!client.includes('prefs.edit().clear()'));
 assert.ok(workflow.includes("versionCode='5'"));
 assert.ok(workflow.includes('android.permission.INTERNET'));
 assert.ok(workflow.includes('apksigner'));
});

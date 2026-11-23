'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
const manifest=fs.readFileSync('app/src/isolated/AndroidManifest.xml','utf8');
const config=JSON.parse(fs.readFileSync('app/src/isolated/google-services.json','utf8'));
const gates=require('../security/phase51-consolidated-gates.json');
test('isolated app cannot replace original app ID',()=>{
 assert.match(gradle,/applicationId\s*=\s*"com\.salonbook\.pro"/);
 assert.match(gradle,/create\("isolated"\)/);
 assert.match(gradle,/applicationIdSuffix\s*=\s*"\.isolated"/);
 assert.match(gradle,/versionNameSuffix\s*=\s*"-isolated-test"/);
});
test('isolated flavor cannot connect to live Firebase and requests no internet permissions',()=>{
 assert.equal(config.project_info.project_id,'demo-boustio-isolated');
 assert.equal(config.client[0].client_info.android_client_info.package_name,'com.salonbook.pro.isolated');
 assert.match(manifest,/android\.permission\.INTERNET" tools:node="remove"/);
 assert.match(manifest,/android\.permission\.ACCESS_NETWORK_STATE" tools:node="remove"/);
 assert.match(manifest,/android:allowBackup="false"/);
});
test('seven launch gates remain open and original Android appointments protected',()=>{
 assert.equal(Object.keys(gates.gates).length,7);
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
 for(const key of ['deployment','messaging','liveBookings','payments'])assert.equal(gates[key],false);
});

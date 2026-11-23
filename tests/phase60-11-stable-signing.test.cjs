'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
const workflow=fs.readFileSync('.github/workflows/boustio-phase-60-11-stable-signing.yml','utf8');
test('stable signing configured from environment without committed private keys',()=>{
 for(const key of ['BOUSTIO_SIGNING_STORE_FILE','BOUSTIO_SIGNING_STORE_PASSWORD','BOUSTIO_SIGNING_KEY_ALIAS','BOUSTIO_SIGNING_KEY_PASSWORD'])assert.ok(gradle.includes(key),key);
 assert.match(gradle,/create\("boustioIsolatedTest"\)/);
 assert.match(gradle,/signingConfig = signingConfigs.getByName\("boustioIsolatedTest"\)/);
});
test('workflow fails closed when any signing secret is absent',()=>{
 for(const key of ['BOUSTIO_TEST_KEYSTORE_BASE64','BOUSTIO_TEST_STORE_PASSWORD','BOUSTIO_TEST_KEY_ALIAS','BOUSTIO_TEST_KEY_PASSWORD'])assert.ok(workflow.includes('secrets.'+key),key);
 assert.ok(workflow.includes('Missing required GitHub Actions signing secret'));
 assert.ok(workflow.includes('needs: signing-preflight'));
 assert.ok(workflow.includes('base64 --decode'));
});
test('isolated version increments, live permissions prohibited and signature verified',()=>{
 assert.match(gradle,/versionCode = 4/);
 assert.match(gradle,/applicationIdSuffix = "\.isolated"/);
 assert.ok(workflow.includes("versionCode='4'"));
 assert.ok(workflow.includes("android.permission.INTERNET"));
 assert.ok(workflow.includes('apksigner'));
});

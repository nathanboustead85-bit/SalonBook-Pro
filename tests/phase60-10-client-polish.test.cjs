'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const g=fs.readFileSync('app/build.gradle.kts','utf8');
test('compact premium client layout with live search and visible history',()=>{
 for(const term of ['TextWatcher','refreshDirectory()','directoryContainer','APPOINTMENT HISTORY','No appointments on this test installation.','R.drawable.boustio_mark','bottomNavigation()'])assert.ok(c.includes(term),term);
 assert.ok(!c.includes('card("Search", "Filter the directory")'));
});
test('existing local data keys preserved, no destructive migration',()=>{
 for(const term of ['client_records_v1','getSharedPreferences("salonbook_data", MODE_PRIVATE)','prefs.getString("bookings"'])assert.ok(c.includes(term),term);
 assert.ok(!c.includes('prefs.edit().clear()'));
 assert.ok(!c.includes('putString("bookings"'));
});
test('isolated package and monotonic app version',()=>{
 assert.match(g,/applicationIdSuffix = "\.isolated"/);
 assert.match(g,/versionCode = 3/);
 assert.match(g,/versionName = "0\.2\.1"/);
});

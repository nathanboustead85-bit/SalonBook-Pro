'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const activity=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const main=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
test('local client profiles support add edit search and safe deletion',()=>{
 for(const text of ['client_records_v1','private fun persist()','private fun load()','private fun edit(','private fun delete(','Search clients by name','Name (required)','Phone','Email','Notes','records.filter { it.name.contains(query, ignoreCase = true) }','Client has bookings; deletion blocked'])assert.ok(activity.includes(text),text);
 assert.match(activity,/\.commit\(\)/);
 assert.match(activity,/UUID\.randomUUID\(\)/);
 assert.match(activity,/android\.util\.Patterns\.EMAIL_ADDRESS/);
});
test('client management is non-exported and linked from premium Clients tab',()=>{
 assert.match(manifest,/<activity android:name="\.ClientActivity" android:exported="false"/);
 assert.match(main,/Intent\(this, ClientActivity::class\.java\)/);
 assert.match(main,/private fun showClientDetails\(/);
});
test('existing bookings remain untouched and launch blockers open',()=>{
 assert.doesNotMatch(activity,/putString\("bookings"/);
 assert.match(activity,/prefs\.getString\("bookings"/);
 assert.match(main,/getSharedPreferences\("salonbook_data", MODE_PRIVATE\)/);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','liveBookings','payments','deployment'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

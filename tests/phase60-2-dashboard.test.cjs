'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const main=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
test('premium teal Boustio dashboard replaces old SalonBook Pro milestone 5',()=>{
 assert.match(main,/screen\("Boustio"\)/);
 assert.match(main,/Color\.rgb\(0, 139, 131\)/);
 assert.match(main,/Your business at a glance/);
 assert.match(main,/A booking platform with a difference/);
 assert.match(main,/dashboardStat\("Today"/);
 assert.match(main,/dashboardStat\("Upcoming"/);
 assert.match(main,/dashboardStat\("Total bookings"/);
 assert.doesNotMatch(main,/screen\("SalonBook Pro"\)|SalonBook Pro \| Milestone 5|Color\.rgb\(111, 66, 193\)/);
});
test('existing booking actions and preference key remain unchanged',()=>{
 for(const text of ['getSharedPreferences("salonbook_data", MODE_PRIVATE)','bookingDialog()','showCalendar()','showAppointments()','showClients()','ManagementActivity::class.java','CloudActivity::class.java','loadBookings()'])assert.ok(main.includes(text),text);
});
test('separate isolated test APK identity and production launch safety',()=>{
 assert.match(gradle,/applicationIdSuffix\s*=\s*"\.isolated"/);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','deployment','payments','liveBookings'])assert.equal(gates[key],false);
});

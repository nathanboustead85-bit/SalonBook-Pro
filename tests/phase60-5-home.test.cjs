'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
test('native home follows premium settings design',()=>{
 for(const phrase of ['Good to see you',"Here's what's happening with your business today.",'Your business at a glance','Quick actions','Upcoming appointments','Manage your business','No upcoming appointments'])assert.ok(src.includes(phrase),phrase);
 assert.match(src,/private fun homeAction\(/);
 assert.match(src,/premiumCard\("›", label, detail, action\)/);
 assert.match(src,/activeTab = "Home"/);
});
test('appointment summary and upcoming cards use real local booking data',()=>{
 for(const phrase of ['bookings.count { it.date == today() }','bookings.count { it.date >= today() }','dashboardStat("Total bookings", bookings.size)','bookings.filter { it.date >= today() }','upcoming.forEach { bookingCard(it) }'])assert.ok(src.includes(phrase),phrase);
});
test('navigation and booking persistence preserved',()=>{
 for(const phrase of ['bookingDialog()','showCalendar()','showClients()','showAppointments()','showBusinessSettings()','getSharedPreferences("salonbook_data", MODE_PRIVATE)','saveBookings()','loadBookings()'])assert.ok(src.includes(phrase),phrase);
});
test('all launch gates remain open',()=>{
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','liveBookings','payments','deployment'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const client=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const main=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
test('client manager matches Boustio branding and bottom tabs',()=>{
 for(const value of ['R.drawable.boustio_mark','A booking platform with a difference','bottomNavigation()','R.drawable.nav_home','R.drawable.nav_calendar','R.drawable.nav_clients','R.drawable.nav_settings','WindowInsets.Type.systemBars()'])assert.ok(client.includes(value),value);
});
test('saved profiles and booking-derived clients appear in unified directory',()=>{
 for(const value of ['records.map { it.name } + readBookingNames()','distinctBy { it.lowercase(Locale.UK) }','readBookingNames()','bookingCount(name)','appointmentHistory(name)','edit(prefillName = name)','private fun edit(id: String? = null, prefillName: String = "")'])assert.ok(client.includes(value),value);
 assert.match(client,/prefs\.getString\("bookings"/);
 assert.doesNotMatch(client,/putString\("bookings"/);
});
test('navigation preserves selected main tab and original booking storage',()=>{
 for(const value of ['openRequestedTab()','onNewIntent(intent: Intent)','boustio_tab','"Calendar" -> showCalendar()','"Clients" -> showClients()','"Settings" -> showBusinessSettings()','getSharedPreferences("salonbook_data", MODE_PRIVATE)'])assert.ok(main.includes(value),value);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','liveBookings','payments','deployment'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

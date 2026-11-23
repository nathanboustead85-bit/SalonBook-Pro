'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
const clients=src.slice(src.indexOf('    private fun showClients()'),src.indexOf('    private fun saveBookings()'));
test('premium client directory and empty state are implemented',()=>{
 for(const phrase of ['Your clients','Client directory','No clients yet','YOUR CLIENTS • BOUSTIO','Create your first appointment','Quick actions'])assert.ok(clients.includes(phrase),phrase);
 assert.match(clients,/premiumCard\("♙", name, description\)/);
 assert.match(clients,/background = rounded\(Color.WHITE/);
});
test('client list and history use existing local bookings only',()=>{
 for(const phrase of ['bookings.map { it.client.trim() }','filter { it.isNotEmpty() }','distinct()','sortedWith(String.CASE_INSENSITIVE_ORDER)','bookings.filter { it.client.trim() == name }','private fun showClientDetails(clientName: String)','history.forEach { bookingCard(it) }'])assert.ok(clients.includes(phrase),phrase);
 assert.match(clients,/showClientDetails\(name\)/);
 assert.match(clients,/bookingDialog\(\)/);
 assert.match(clients,/showClients\(\)/);
});
test('no invented contact information or unsafe migration',()=>{
 assert.doesNotMatch(clients,/contactPhone|contactEmail|phoneNumber|emailAddress|SharedPreferences\(/);
 for(const phrase of ['getSharedPreferences("salonbook_data", MODE_PRIVATE)','saveBookings()','loadBookings()'])assert.ok(src.includes(phrase),phrase);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','liveBookings','payments','deployment'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

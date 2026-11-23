'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
test('premium settings screenshot sections and cards implemented in native Android',()=>{
 for(const label of ['Business settings','Make Boustio work beautifully for your business.','Everything in its place','Business management','Services & Prices','Staff & Working Hours','My Boustio Booking Link','Customer Messages','Account and tools','Cloud Account & Backup','Test Appointment Availability','All Appointments'])assert.ok(src.includes(label),label);
 assert.match(src,/private fun premiumCard\(/);
 assert.match(src,/private fun showBusinessSettings\(/);
 assert.match(src,/background = rounded\(Color.WHITE/);
});
test('persistent navigation has four working tabs',()=>{
 for(const label of ['"Home"','"Calendar"','"Clients"','"Settings"'])assert.ok(src.includes(label));
 assert.match(src,/root\.addView\(bottomNavigation\(\)\)/);
 assert.match(src,/showBusinessSettings\(\)/);
 assert.match(src,/showCalendar\(\)/);
 assert.match(src,/showClients\(\)/);
});
test('original booking storage and workflows remain present',()=>{
 for(const label of ['getSharedPreferences("salonbook_data", MODE_PRIVATE)','saveBookings()','loadBookings()','bookingDialog()','bookingOptions(booking)','showAppointments()'])assert.ok(src.includes(label),label);
});
test('chat and booking links are explicitly non-live and seven gates remain open',()=>{
 assert.match(src,/Customer messaging is not enabled/);
 assert.match(src,/Booking link is not connected/);
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 for(const key of ['messaging','deployment','payments','liveBookings'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

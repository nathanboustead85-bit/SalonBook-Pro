'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
const calendar=src.slice(src.indexOf('    private fun showCalendar()'),src.indexOf('    private fun showAppointments()'));
const card=src.slice(src.indexOf('    private fun bookingCard(booking: Booking)'),src.indexOf('    private fun bookingOptions('));
test('calendar uses premium date selector, diary and empty state',()=>{
 for(const text of ['Appointment calendar','SELECTED DATE','Choose another date','Your diary','Appointments','No appointments on this date','Quick actions'])assert.ok(calendar.includes(text),text);
 assert.match(calendar,/background = rounded\(Color.WHITE/);
 assert.match(calendar,/background = rounded\(mint/);
});
test('date filtering, ordering and booking actions remain functional',()=>{
 for(const text of ['bookings.filter { it.date == selectedDate }.sortedBy { it.time }','pickDate(selectedDate)','selectedDate = it','bookingDialog(defaultDate = selectedDate)','daily.forEach { bookingCard(it) }','showAppointments()'])assert.ok(calendar.includes(text),text);
 assert.match(card,/bookingOptions\(booking\)/);
 assert.match(card,/Manage appointment/);
});
test('isolated app preserves existing booking storage and launch blockers',()=>{
 for(const text of ['getSharedPreferences("salonbook_data", MODE_PRIVATE)','saveBookings()','loadBookings()'])assert.ok(src.includes(text),text);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','liveBookings','payments','deployment'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const src=fs.readFileSync("app/src/main/java/com/salonbook/pro/MainActivity.kt","utf8");
const a=src.indexOf("private fun showClientProfile("),b=src.indexOf("private fun registeredClients()",a),profile=src.slice(a,b);
test("12.13 read-only client visit summary",()=>{
 for(const x of ["CLIENT VISIT OVERVIEW","appointment","Appointment history is listed newest first","history.forEach { bookingCard(it) }"])assert.ok(profile.includes(x));
});
test("12.13 calendar and client directory navigation",()=>{
 assert.ok(profile.includes('button("View Calendar") { showCalendar() }'));
 assert.ok(profile.includes('button("Back to Clients") { showClients() }'));
});
test("12.13 history overview does not modify appointments",()=>{
 const h=profile.slice(profile.indexOf("// Phase 12.13: read-only history overview."));
 assert.doesNotMatch(h,/saveBookings\(|bookings\.remove\(|bookings\.clear\(|ref\.set\(/);
});

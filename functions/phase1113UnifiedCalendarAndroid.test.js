"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const main=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const source=fs.readFileSync(path.join(root,"app/src/debug/java/com/salonbook/pro/debug/DebugCalendarSource.kt"),"utf8");
const session=fs.readFileSync(path.join(root,"app/src/debug/java/com/salonbook/pro/debug/UnifiedCalendarSession.kt"),"utf8");
test("11.13 normal calendar uses debug source, not hardcoded demo appointments",()=>{
 assert.match(main,/showDebugWebsiteBookingPreview\(selectedDate\)/);
 assert.match(main,/DebugCalendarSource/);
 assert.doesNotMatch(main,/Demo haircut • Demo Barber/);
});
test("11.13 no owner token persistence or production Firebase network access",()=>{
 assert.match(source,/demoBusiness/);assert.match(source,/demoOwnerToken/);
 assert.doesNotMatch(source+session,/SharedPreferences|FirebaseFirestore|firebaseio\.com|salonbook-pro-ad5ff/);
 assert.match(source,/Emulator not connected/);
});
test("11.13 refresh retries and discards stale updates after navigation",()=>{
 assert.match(session,/postDelayed\(\{ poll\(current\) \}, 5000\)/);
 assert.match(session,/generation\.get\(\) != current/);
 assert.match(main,/if \(mode != "calendar"\) debugCalendarSource\?\.stop\(\)/);
 assert.match(main,/debugCalendarSource\?\.stop\(\)/);
});
test("11.13 feed never writes to local or production bookings",()=>{
 const start=main.indexOf("private fun showDebugWebsiteBookingPreview("),end=main.indexOf("private fun showAppointments()",start);
 const body=main.slice(start,end);
 for(const unsafe of ["saveBookings(", "bookings.add(", "bookings.remove", "FirebaseFirestore", "collection(", "putString("])assert.equal(body.includes(unsafe),false,unsafe);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const main=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
test("11.10 demo website appointments render in existing calendar, not a second screen",()=>{
 assert.match(main,/private fun showDebugWebsiteBookingPreview\(date: String\)/);
 assert.match(main,/if \(BuildConfig.DEBUG\) \{\s*showDebugWebsiteBookingPreview\(selectedDate\)/);
 assert.doesNotMatch(main,/Website booking feed • DEV ONLY/);
});
test("11.10 demo preview is labelled synthetic and shows confirmed and cancelled",()=>{
 assert.match(main,/DEMO PREVIEW ONLY/);
 assert.match(main,/No live website connection/);
 assert.match(main,/CONFIRMED/);assert.match(main,/CANCELLED/);
});
test("11.10 preview does not save, modify or merge existing bookings",()=>{
 const start=main.indexOf("private fun showDebugWebsiteBookingPreview("),end=main.indexOf("private fun showAppointments()",start);
 assert.ok(start>=0&&end>start);
 const body=main.slice(start,end);
 for(const unsafe of ["saveBookings(", "bookings.add(", "bookings.remove", "FirebaseFirestore", "collection(", "putString("])assert.equal(body.includes(unsafe),false,unsafe);
});
test("11.10 production release remains excluded by debug condition",()=>{
 assert.match(main,/if \(BuildConfig.DEBUG\)/);
 assert.match(fs.readFileSync(path.join(root,"app/build.gradle.kts"),"utf8"),/applicationIdSuffix = ".devcalendar"/);
 assert.equal(fs.readFileSync(path.join(root,"settings.gradle.kts"),"utf8").includes("phase118"),false);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app/src/debug/java/com/salonbook/pro/debug/EmulatorCalendarFeed.kt"),"utf8");
const manifest=fs.readFileSync(path.join(root,"app/src/debug/res/xml/debug_calendar_network_security.xml"),"utf8");
const main=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
test("11.12 emulator calendar adapter only exists in Android debug source set",()=>{
 assert.match(source,/object EmulatorCalendarFeed/);
 assert.equal(fs.existsSync(path.join(root,"app/src/main/java/com/salonbook/pro/debug/EmulatorCalendarFeed.kt")),false);
 assert.doesNotMatch(main,/EmulatorCalendarFeed/);
});
test("11.12 transport targets loopback only and never production Firebase",()=>{
 assert.match(source,/http:\/\/127\.0\.0\.1:8765\/api\/owner-calendar/);
 assert.match(manifest,/<domain>127\.0\.0\.1<\/domain>/);
 assert.match(manifest,/base-config cleartextTrafficPermitted="false"/);
 assert.doesNotMatch(source,/salonbook-pro-ad5ff|firebaseio\.com|cloudfunctions\.net/);
});
test("11.12 rejects forged data and duplicate calendar IDs",()=>{
 for(const marker of ["seen.add(id)","demo_customer_web","confirmed","cancelled","localDate","ownerToken.isNotBlank()","responseCode == 200"])assert.ok(source.includes(marker),marker);
});
test("11.12 adapter is read-only and never changes bookings",()=>{
 assert.doesNotMatch(source,/\.set\(|\.update\(|\.delete\(|saveBookings|bookings\.add/);
 assert.match(source,/requestMethod = "POST"/);
});

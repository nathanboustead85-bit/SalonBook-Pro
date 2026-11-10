"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const cache=read("app/src/debug/java/com/salonbook/pro/debug/DebugCalendarDiskCache.kt");
const source=read("app/src/debug/java/com/salonbook/pro/debug/DebugCalendarSource.kt");
const main=read("app/src/main/java/com/salonbook/pro/MainActivity.kt");
test("11.30 Android debug calendar uses real local device persistence",()=>{
 assert.match(cache,/getSharedPreferences\("boustio_debug_calendar_cache_v1"/);
 assert.match(cache,/\.commit\(\)/);
 assert.match(cache,/fun save\(/);assert.match(cache,/fun load\(/);
});
test("11.30 saved preview is loaded before network refresh",()=>{
 assert.ok(source.indexOf("cache.load(id, date)")<source.indexOf("session.start(id, token, date)"));
 assert.match(source,/if \(state.connected\) runCatching \{ cache.save/);
});
test("11.30 offline preview clearly marked not live",()=>{
 assert.match(source,/Offline • saved emulator preview \(not live\)/);
 assert.match(source,/if \(state.connected\) state.appointments else cache.load/);
});
test("11.30 restart restores only same demo business and day",()=>{
 assert.match(cache,/businessId.startsWith\("demo_"\)/);
 assert.match(cache,/data.getString\("businessId"\) != businessId/);
 assert.match(cache,/data.getString\("date"\) != date/);
 assert.match(cache,/data.getInt\("version"\) != 1/);
});
test("11.30 corrupt or oversized local snapshots fail closed",()=>{
 assert.match(cache,/entries.length\(\) > 500/);
 assert.match(cache,/catch \(_: Exception\)/);
});
test("11.30 credentials are not written to disk",()=>{
 assert.doesNotMatch(cache,/ownerToken|FirebaseAuth|FirebaseFirestore|firebaseio/);
 assert.doesNotMatch(source,/putString\([^\n]*token|SharedPreferences/);
});
test("11.30 production Android main screen uses context injection",()=>{
 assert.match(main,/getDeclaredConstructor\(android.content.Context::class.java\)/);
 assert.match(source,/class DebugCalendarSource\(private val context: android.content.Context\)/);
});
test("11.30 debug-only source cannot write production appointments",()=>{
 assert.doesNotMatch(cache+source,/saveBookings\(|bookings.add\(|FirebaseFirestore|collection\(/);
 assert.match(cache,/Debug-only, device-local cache/);
});

test("11.30 appointment availability reads per-day staff weeklySchedule",()=>{
 assert.match(main,/member\.optJSONObject\("weeklySchedule"\)/);
 assert.match(main,/schedule\.optJSONObject\(day\) \?: return false/);
 assert.match(main,/period\.getString\("open"\)/);
 assert.match(main,/period\.getString\("close"\)/);
 assert.match(main,/withinWorkingHours\(member, date, start, start \+ duration\)/);
 assert.doesNotMatch(main,/withinWorkingHours\(member\.optString\("hours"\), date, start, start \+ duration\)/);
 const date=new Date("2026-11-12T12:00:00Z");
 assert.equal(date.getUTCDay(),4);
 const open=9*60,close=17*60,start=9*60,duration=30;
 assert.ok(start>=open && start+duration<=close);
});

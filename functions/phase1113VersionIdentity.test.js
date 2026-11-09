"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const gradle=fs.readFileSync(path.join(root,"app/build.gradle.kts"),"utf8");
const manifest=fs.readFileSync(path.join(root,"app/src/debug/AndroidManifest.xml"),"utf8");
const main=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
test("11.13 Android launcher and in-calendar marker agree",()=>{
 assert.match(manifest,/Boustio DEV 11\.13/);
 assert.match(main,/WEBSITE BOOKINGS • EMULATOR ONLY • PHASE 11\.13/);
 assert.doesNotMatch(manifest,/DEV 11\.10/);
});
test("11.13 debug version increases without changing production version or creating another app ID",()=>{
 assert.match(gradle,/versionCode = 5/);
 assert.match(gradle,/versionName = "0\.5\.0"/);
 assert.doesNotMatch(gradle,/versionCode = 1113/);
 assert.match(gradle,/applicationIdSuffix = "\.devcalendar1110"/);
 assert.match(gradle,/versionNameSuffix = "-calendar-dev-11\.13"/);
});

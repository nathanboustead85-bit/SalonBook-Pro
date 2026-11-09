"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const debug=path.join(root,"app/src/debug/java/com/salonbook/pro/debug/SecureCloudCalendarContract.kt");
const source=fs.readFileSync(debug,"utf8");
const main=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const manifest=fs.readFileSync(path.join(root,"app/src/debug/AndroidManifest.xml"),"utf8");
test("11.16 Android cloud transport is debug-only and has no approved endpoint",()=>{
 assert.match(source,/approvedHosts = emptySet<String>\(\)/);
 assert.match(source,/uri\.scheme == "https"/);
 assert.match(source,/uri\.host in approvedHosts/);
 assert.match(source,/uri\.userInfo == null && uri\.query == null && uri\.fragment == null/);
 assert.match(source,/uri\.port == -1 \|\| uri\.port == 443/);
 assert.equal(fs.existsSync(path.join(root,"app/src/main/java/com/salonbook/pro/debug/SecureCloudCalendarContract.kt")),false);
 assert.doesNotMatch(main,/SecureCloudCalendarContract/);
});
test("11.16 synthetic owner/date validation, no production URL or embedded credentials",()=>{
 assert.match(source,/demo_\[A-Za-z0-9_-\]/);
 assert.match(source,/LocalDate\.parse/);
 assert.match(source,/ownerToken\.isNotBlank\(\)/);
 assert.doesNotMatch(source,/salonbook-pro-ad5ff|cloudfunctions\.net|firebaseio\.com|boustio\.co\.uk|http:\/\//);
 assert.doesNotMatch(source,/HttpURLConnection|\.openConnection\(|FirebaseFirestore|\.set\(|\.update\(/);
 assert.match(manifest,/Boustio DEV 11\.13/);
});

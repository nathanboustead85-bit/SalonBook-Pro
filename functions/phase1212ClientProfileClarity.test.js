"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync("app/src/main/java/com/salonbook/pro/MainActivity.kt","utf8");
const start = src.indexOf("private fun showClientProfile(");
const end = src.indexOf("private fun registerClientDialog(",start);
const profile = src.slice(start,end);
test("12.12 persistent labels are above client input fields",()=>{
 assert.match(profile,/contact\.addView\(label\(hint\.uppercase\(Locale\.UK\), 12f, muted, true\)/);
 for(const field of ["Client name","Phone number","Email address","Client notes"]) assert.ok(profile.includes('input("'+field+'"'));
});
test("12.12 fields remain accessible with content descriptions",()=>{
 assert.match(profile,/contentDescription = hint/);
});
test("12.12 no appointment mutation introduced",()=>{
 assert.doesNotMatch(profile,/bookings\.clear\(|bookings\.remove\(|saveBookings\(/);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const a=src.indexOf("private fun showClientProfile(name: String)"),b=src.indexOf("private fun registeredClients()",a),profile=src.slice(a,b);
test("12.5 premium profile identity card includes initials and appointment count",()=>{for(const x of ["CLIENT PROFILE","val avatar = label(","identity.addView(avatar","history.size","rounded(paleOrange, 22)"])assert.ok(profile.includes(x));});
test("12.5 contact details preserve existing saved fields",()=>{for(const x of ['saved.optString("phone")','saved.optString("email")','saved.optString("notes")','Save Client Details'])assert.ok(profile.includes(x));});
test("12.5 cloud backup and restore remain explicit user actions",()=>{for(const x of ['Back Up This Client to Cloud','Restore This Client from Cloud','Replace cloud client profile?','Restore cloud client?'])assert.ok(profile.includes(x));});
test("12.5 appointment history remains read-only and ordered",()=>{assert.match(profile,/compareByDescending<Booking>/);assert.match(profile,/history\.forEach \{ bookingCard\(it\) \}/);});
test("12.5 no automatic booking mutation in client profile",()=>{assert.doesNotMatch(profile,/saveBookings\(|bookings\.remove|bookings\.clear\(/);});

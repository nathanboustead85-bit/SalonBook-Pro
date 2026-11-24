const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const c = fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const b = fs.readFileSync('app/build.gradle.kts','utf8');
test('appointment counts are indexed once per directory refresh', () => {
 const start=c.indexOf('private fun refreshDirectory()');
 const end=c.indexOf('private fun readBookingNames()',start);
 const directory=c.slice(start,end);
 assert.equal((directory.match(/readBookingNames\(\)/g)||[]).length,1);
 assert.match(directory,/groupingBy \{ it\.lowercase\(Locale\.UK\) \}\.eachCount\(\)/);
 assert.match(directory,/compareByDescending<String> \{ countFor\(it\) \}/);
 assert.match(directory,/val count = countFor\(name\)/);
 assert.match(directory,/directoryNames\.sumOf \{ countFor\(it\) \}/);
 assert.doesNotMatch(directory,/bookingCount\(/);
});
test('existing client search and data safety preserved', () => {
 for(const token of ['client_records_v1','client_directory_sort_v1','clientDataReadable','contact?.phone','contact?.email','appointmentHistory(name)']) assert.ok(c.includes(token),token);
});
test('signed isolated build increments to 11', () => {
 for(const token of ['versionCode = 11','versionName = "0.2.9"','applicationIdSuffix = ".isolated"']) assert.ok(b.includes(token),token);
});

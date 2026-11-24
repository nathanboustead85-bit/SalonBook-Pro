const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const client = fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const build = fs.readFileSync('app/build.gradle.kts','utf8');
test('search supports client name phone and email', () => {
 for(const token of ['Search name, phone or email','contact?.phone?.contains(query','contact?.email?.contains(query','name.contains(query']) assert.ok(client.includes(token),token);
});
test('sort options and match count exist', () => {
 for(const token of ['Name A-Z','Name Z-A','Most appointments','matching client(s)']) assert.ok(client.includes(token),token);
});
test('preserve isolated package, version upgrade, persistent records and booking safety', () => {
 for(const token of ['versionCode = 7','versionName = "0.2.5"','applicationIdSuffix = ".isolated"','boustioIsolatedTest']) assert.ok(build.includes(token),token);
 for(const token of ['client_records_v1','getString("bookings"','persist()','Client has bookings; deletion blocked']) assert.ok(client.includes(token),token);
});

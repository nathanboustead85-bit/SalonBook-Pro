const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const client = fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const build = fs.readFileSync('app/build.gradle.kts','utf8');
test('clear search is accessible and does not modify records', () => {
 for (const s of ['contentDescription = "Clear client search"','search.setText("")','search.clearFocus()','Showing ${visible.size} client(s)','Open client $name']) assert.ok(client.includes(s),s);
});
test('name phone email search and sorting remain', () => {
 for(const s of ['contact?.phone?.contains(query','contact?.email?.contains(query','Name A-Z','Name Z-A','Most appointments']) assert.ok(client.includes(s),s);
});
test('isolated signing and persisted client data preserved', () => {
 for(const s of ['versionCode = 8','versionName = "0.2.6"','applicationIdSuffix = ".isolated"','boustioIsolatedTest']) assert.ok(build.includes(s),s);
 for(const s of ['client_records_v1','getString("bookings"','Client has bookings; deletion blocked']) assert.ok(client.includes(s),s);
});

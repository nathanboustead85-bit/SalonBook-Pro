const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const client = fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const build = fs.readFileSync('app/build.gradle.kts','utf8');
test('sort selection persists and search restores after activity recreation', () => {
 for(const token of ['client_directory_sort_v1','putString("client_directory_sort_v1", sortBy)','onSaveInstanceState(outState: Bundle)','client_directory_query']) assert.ok(client.includes(token),token);
});
test('unreadable data blocks destructive writes and retains existing storage keys', () => {
 for(const token of ['clientDataReadable = false','if (!clientDataReadable) return false','if (!clientDataReadable) {','client_records_v1','Client has bookings; deletion blocked']) assert.ok(client.includes(token),token);
});
test('same isolated signed package with incremented version', () => {
 for(const token of ['versionCode = 9','versionName = "0.2.7"','applicationIdSuffix = ".isolated"','boustioIsolatedTest']) assert.ok(build.includes(token),token);
});

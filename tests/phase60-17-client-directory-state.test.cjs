const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const client = fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const build = fs.readFileSync('app/build.gradle.kts','utf8');
test('unreadable records have explicit non-empty-state warning', () => {
 assert.match(client, /!clientDataReadable -> "Saved client records are unavailable/);
 assert.match(client, /Editing is disabled; do not clear app data/);
 assert.match(client, /directoryNames\.isEmpty\(\) -> "No clients yet/);
 assert.match(client, /query\.isNotBlank\(\) -> "No matching clients/);
});
test('client write protection, existing keys and sorting retained', () => {
 for (const token of ['if (!clientDataReadable) return false','client_records_v1','client_directory_sort_v1','client_directory_query','client_records_v1']) assert.ok(client.includes(token),token);
});
test('signed isolated package build incremented', () => {
 for(const token of ['versionCode = 10','versionName = "0.2.8"','applicationIdSuffix = ".isolated"']) assert.ok(build.includes(token),token);
});

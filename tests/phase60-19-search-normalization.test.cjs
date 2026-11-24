const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const client=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const build=fs.readFileSync('app/build.gradle.kts','utf8');
test('directory normalizes whitespace and case for all search fields',()=>{
 for(const token of ['val normalizedQuery = normalized(query)','normalized(name).contains(normalizedQuery)','normalized(it).contains(normalizedQuery)','lowercase(Locale.UK)']) assert.ok(client.includes(token),token);
 assert.match(client,/replace\(Regex\("\\\\s\+"\), " "\)/);
});
test('safe client storage and sorting unchanged',()=>{
 for(const token of ['client_records_v1','client_directory_sort_v1','if (!clientDataReadable) return false','Most appointments','countFor(name)']) assert.ok(client.includes(token),token);
});
test('isolated signed test build 12',()=>{
 for(const token of ['versionCode = 12','versionName = "0.2.10"','applicationIdSuffix = ".isolated"']) assert.ok(build.includes(token),token);
});

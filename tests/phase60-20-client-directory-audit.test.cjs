const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const b=fs.readFileSync('app/build.gradle.kts','utf8');
const workflow=fs.readFileSync('.github/workflows/boustio-phase-60-20-client-directory-audit.yml','utf8');
test('saved client records, search and sort preferences remain intact',()=>{
for(const x of ['client_records_v1','client_directory_sort_v1','val normalizedQuery = normalized(query)','normalized(name).contains(normalizedQuery)','Most appointments','Name Z-A','readBookingNames()']) assert.ok(c.includes(x),x);
});
test('unreadable records remain fail-closed and no destructive migration',()=>{
assert.ok(c.includes('if (!clientDataReadable) return false'));
assert.ok(!c.includes('deleteDatabase('));
assert.ok(!c.includes('clear().commit()'));
});
test('single booking-name read per directory refresh and indexed counts',()=>{
assert.ok(c.includes('val bookingNames = readBookingNames()'));
assert.ok(c.includes('val appointmentCounts = bookingNames.groupingBy'));
assert.ok(c.includes('fun countFor(name: String)'));
});
test('isolated offline signed test build 13',()=>{
for(const x of ['versionCode = 13','versionName = "0.2.11"','applicationIdSuffix = ".isolated"'])assert.ok(b.includes(x),x);
assert.ok(workflow.includes('! grep -q "uses-permission: name=\'android.permission.INTERNET\'"'));
});

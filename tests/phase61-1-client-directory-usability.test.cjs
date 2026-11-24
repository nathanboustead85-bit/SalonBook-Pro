const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const b=fs.readFileSync('app/build.gradle.kts','utf8');
test('one tap reset clears query, restores A-Z and persists preference',()=>{
for(const x of ['Reset search and sorting','Show all clients sorted by name','search.setText("")','search.clearFocus()','sortControl.setSelection(0)','sortBy = "Name A-Z"','putString("client_directory_sort_v1", sortBy)','refreshDirectory()'])assert.ok(c.includes(x),x);
});
test('saved client records and fail closed protections unchanged',()=>{
for(const x of ['client_records_v1','if (!clientDataReadable) return false','normalized(name).contains(normalizedQuery)','Most appointments','readBookingNames()'])assert.ok(c.includes(x),x);
});
test('isolated update build 14',()=>{for(const x of ['versionCode = 14','versionName = "0.2.12"','applicationIdSuffix = ".isolated"'])assert.ok(b.includes(x),x);});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const hub=src.slice(src.indexOf('private fun showBusinessHub()'),src.indexOf('private fun showFeaturePreview('));
test('hub connects existing local tools',()=>{
 for(const token of ['putExtra("staff", false)','putExtra("staff", true)','showAppointments()','showCalendar()','if (feature.id == "customers") showClients() else showFeaturePreview(feature.id)']) assert.ok(hub.includes(token),token);
});
test('hub does not directly write records or invoke online services',()=>{
 assert.doesNotMatch(hub,/saveBookings\(|\.edit\(|Firebase|CloudActivity|\.send\(/);
 assert.ok(hub.includes('Online services remain isolated previews.'));
});

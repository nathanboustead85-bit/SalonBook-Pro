const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const preview=src.slice(src.indexOf('private fun showFeaturePreview('),src.indexOf('private fun showCalendar()'));
test('advanced tools have explicit safe content and local routes',()=>{
 for(const token of ['"team" ->','"messages" ->','"reports" ->','readRecords("staff").size','bookings.size','distinct().size','showAppointments()','putExtra("staff", true)','Delivery disabled','permissions are preview only']) assert.ok(preview.includes(token),token);
});
test('advanced previews never directly mutate or send data',()=>{
 assert.doesNotMatch(preview,/saveBookings\(|\.edit\(|Firebase|CloudActivity|\.send\(|bookings\.(add|remove|clear)/);
 assert.ok(preview.includes('ISOLATED PREVIEW'));
});

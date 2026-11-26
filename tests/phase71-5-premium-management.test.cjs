const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const s=fs.readFileSync('app/src/main/java/com/salonbook/pro/ManagementActivity.kt','utf8');
test('premium shared management screen',()=>{for(const t of ['rounded(teal, 14)','rounded(Color.WHITE, 18)','dp(48)','Your team starts here','Your catalogue starts here','addButton("Back")']) assert.ok(s.includes(t),t);});
test('existing local storage and edit contracts retained',()=>{for(const t of ['getSharedPreferences("salonbook_data", MODE_PRIVATE)','if (staffMode) "staff" else "services"','putString(storageKey, array.toString())','records.remove(item)','UUID.randomUUID()','item.put("hours", t)','item.put("duration", t.toInt())']) assert.ok(s.includes(t),t);assert.doesNotMatch(s,/Firebase|\.send\(/);});

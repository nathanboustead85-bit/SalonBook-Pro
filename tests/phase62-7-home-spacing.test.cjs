const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('empty upcoming card has same 14dp bottom margin as premium cards',()=>{
 const source=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
 const dashboard=source.split('private fun showDashboard()')[1].split('private fun showCalendar()')[0];
 assert.match(dashboard,/container\.addView\(empty, LinearLayout\.LayoutParams\(-1, -2\)\.apply \{\s*bottomMargin = dp\(14\)\s*\}\)/);
 assert.match(dashboard,/homeAction\("View all appointments"/);
});

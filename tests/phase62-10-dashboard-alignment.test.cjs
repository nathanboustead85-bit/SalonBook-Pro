const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('dashboard stats share the tallest card height', () => {
 const source = fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
 assert.ok(source.includes('stats.addView(stat, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f)'));
 assert.ok(source.includes('dashboardStat("Total bookings", bookings.size)'));
});

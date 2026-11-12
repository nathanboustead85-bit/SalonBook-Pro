const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const section = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const resume = section('override fun onPause()', 'private fun today()');
assert.doesNotMatch(resume,/showDashboard\(|showClients\(|showCalendar\(/,'Backgrounding must not redraw screens');
const create = section('override fun onCreate(', 'override fun onSaveInstanceState');
for (const mode of ['calendar','appointments','clients','client_profile','settings','availability']) {
  assert.ok(create.includes('"'+mode+'"'), 'Restore '+mode);
}
assert.match(source,/outState\.putString\("currentScreen", currentScreen\)/);
assert.match(source,/outState\.putString\("activeClientName", activeClientName\)/);
assert.match(source,/navigationPrefs\.edit\(\)/);
assert.match(source,/private val navigationPrefs by lazy \{ getSharedPreferences\("boustio_navigation", MODE_PRIVATE\) \}/);
assert.match(source,/private fun showClientProfile\(name: String\) \{\s*activeClientName = name/);
assert.match(source,/actionCard\("Cloud Account & Backup"[^\n]*"☁"\)/);
assert.match(source,/actionCard\("Services & Prices"[^\n]*"≡"\)/);
assert.match(source,/actionCard\("Staff & Working Hours"[^\n]*"♙"\)/);
console.log('Boustio usability source regression checks passed.');

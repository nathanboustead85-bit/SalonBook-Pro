'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gates=require('../security/phase51-consolidated-gates.json');
test('bottom navigation uses real vector assets and handles system insets',()=>{
 assert.match(src,/setOnApplyWindowInsetsListener/);
 assert.match(src,/WindowInsets\.Type\.systemBars\(\)/);
 assert.match(src,/view\.setPadding\(0, bars\.top, 0, bars\.bottom\)/);
 for(const name of ['nav_home','nav_calendar','nav_clients','nav_settings']) {
  assert.match(src,new RegExp('R\\.drawable\\.'+name));
  const xml=fs.readFileSync('app/src/main/res/drawable/'+name+'.xml','utf8');
  assert.match(xml,/<vector /);
  assert.match(xml,/<path /);
 }
});
test('Boustio logo vector replaces temporary letter placeholder',()=>{
 assert.match(src,/R\.drawable\.boustio_mark/);
 assert.match(src,/Boustio brand mark/);
 const logo=fs.readFileSync('app/src/main/res/drawable/boustio_mark.xml','utf8');
 assert.match(logo,/#[0-9A-Fa-f]{6}/);
 assert.match(logo,/<vector /);
});
test('booking persistence unchanged and launch gates remain closed',()=>{
 assert.match(src,/getSharedPreferences\("salonbook_data", MODE_PRIVATE\)/);
 assert.match(src,/private fun saveBookings\(/);
 assert.match(src,/private fun loadBookings\(/);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','liveBookings','payments','deployment'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('node:fs').readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const m=s.slice(s.indexOf('private fun showMessagingRehearsal()'),s.indexOf('private fun showWaitingList()'));
test('messaging rehearsal is bounded, paused by default and isolated',()=>{
 for(const token of ['isChecked = true','count >= 30','LengthFilter(1000)','Clear conversation rehearsal?','not uploaded','not recorded','history.removeAllViews()']) assert.ok(m.includes(token),token);
 assert.doesNotMatch(m,/prefs|Firebase|https:|MediaRecorder|saveBookings/);
});

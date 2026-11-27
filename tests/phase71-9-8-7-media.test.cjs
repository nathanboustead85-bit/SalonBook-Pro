const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('node:fs').readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
test('local media preview guards',()=>{
 for(const token of ['RECORD_SOUND_ACTION','ACTION_OPEN_DOCUMENT','inSampleSize','history.isAttachedToWindow','FLAG_GRANT_READ_URI_PERMISSION','mediaPreviewResult = null','requestCode == 7187 || requestCode == 7188']) assert.ok(s.includes(token),token);
});

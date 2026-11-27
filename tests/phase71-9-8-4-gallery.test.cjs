const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('node:fs').readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const gallery=s.slice(s.indexOf('private var pendingPortfolioPhotoId'),s.indexOf('private fun showBusinessHub()'));
test('private bounded image import and confirmed removal',()=>{
 for(const token of ['noBackupFilesDir','ACTION_OPEN_DOCUMENT','inJustDecodeBounds','inSampleSize','AtomicFile','failWrite','Remove photo?','readRecords("local_portfolio_drafts_v1")']) assert.ok(gallery.includes(token),token);
 assert.doesNotMatch(gallery,/Firebase|https:\/\//);
});

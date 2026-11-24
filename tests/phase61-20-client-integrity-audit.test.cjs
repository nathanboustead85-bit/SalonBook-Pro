const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8'),b=fs.readFileSync('app/build.gradle.kts','utf8');
test('read-only client data integrity review reports counts and ID warnings',()=>{
 const start=c.indexOf('private fun showClientIntegrityCheck()'),end=c.indexOf('private var directoryContainer',start);
 assert.ok(start>0&&end>start);
 const block=c.slice(start,end);
 for(const x of ['clientDataReadable','records.size','it.phone.isBlank()','it.email.isBlank()','it.id.isBlank()','Repeated client IDs: $duplicateIds','Review only','No changes were made'])assert.ok(block.includes(x),x);
 for(const x of ['persist()','records.remove','records.add','prefs.edit()','startActivity('])assert.ok(!block.includes(x),'No mutation allowed: '+x);
});
test('Phase 61 contact features preserved and isolated version increments',()=>{
 for(const x of ['Check possible duplicate clients','Share client contact','Copy client summary','WhatsApp client','Call client','Email client','Copy phone number','Copy email address'])assert.ok(c.includes(x),x);
 for(const x of ['versionCode = 33','versionName = "0.2.31"','applicationIdSuffix = ".isolated"'])assert.ok(b.includes(x),x);
});

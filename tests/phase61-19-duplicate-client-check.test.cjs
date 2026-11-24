const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8'),b=fs.readFileSync('app/build.gradle.kts','utf8');
test('read-only duplicate client check uses nonblank phone and email',()=>{
 const start=c.indexOf('private fun showPossibleDuplicates()'),end=c.indexOf('private var directoryContainer',start);
 assert.ok(start>0&&end>start);
 const block=c.slice(start,end);
 for(const x of ['clientDataReadable','digits.takeIf { it.length >= 7 }','it.isNotBlank()','records.groupBy { normalizedPhone(it.phone) }','records.groupBy { normalizedEmail(it.email) }','clients.size > 1','Possible duplicate clients','Shared contact details do not prove duplicate clients'])assert.ok(block.includes(x),x);
 for(const x of ['persist()','records.remove','records.add','prefs.edit()','startActivity('])assert.ok(!block.includes(x),'Review-only feature: '+x);
});
test('client contact actions and isolated stable update preserved',()=>{
 for(const x of ['Check possible duplicate clients','Share client contact','Copy client summary','WhatsApp client'])assert.ok(c.includes(x),x);
 for(const x of ['versionCode = 32','versionName = "0.2.30"','applicationIdSuffix = ".isolated"'])assert.ok(b.includes(x),x);
});

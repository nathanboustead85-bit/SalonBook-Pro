const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8');
const b=fs.readFileSync('app/build.gradle.kts','utf8');
test('client summary is explicit copy action and excludes notes',()=>{
 const start=c.indexOf('text = "Copy client summary"');
 const end=c.indexOf('profile.addView(label("CLIENT NOTES"',start);
 assert.ok(start>0&&end>start);
 const block=c.slice(start,end);
 for(const x of ['setOnClickListener','c.name.trim()','c.phone.trim()','c.email.trim()','ClipData.newPlainText("Client contact summary", summary)','clipboard.setPrimaryClip','joinToString("\\n")']) assert.ok(block.includes(x),x);
 assert.ok(!block.includes('c.notes'),'Private notes must not be copied');
});
test('existing WhatsApp and copy actions and stable isolated install preserved',()=>{
 for(const x of ['WhatsApp client','Copy phone number','Copy email address','https://wa.me/$number'])assert.ok(c.includes(x),x);
 for(const x of ['versionCode = 30','versionName = "0.2.28"','applicationIdSuffix = ".isolated"'])assert.ok(b.includes(x),x);
});

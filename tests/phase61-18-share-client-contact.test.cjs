const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=fs.readFileSync('app/src/main/java/com/salonbook/pro/ClientActivity.kt','utf8'),b=fs.readFileSync('app/build.gradle.kts','utf8');
test('manual Android chooser shares only client contact details',()=>{
 const start=c.indexOf('text = "Share client contact"'),end=c.indexOf('profile.addView(label("CLIENT NOTES"',start);
 assert.ok(start>0&&end>start);
 const block=c.slice(start,end);
 for(const s of ['setOnClickListener','c.name.trim()','c.phone.trim()','c.email.trim()','Intent.ACTION_SEND','Intent.EXTRA_TEXT','Intent.createChooser(share, "Share client contact")'])assert.ok(block.includes(s),s);
 assert.ok(!block.includes('c.notes'),'Do not share private notes');
 assert.ok(!block.includes('startActivity(share)'),'Always show chooser');
});
test('existing client actions and isolated stable update preserved',()=>{
 for(const s of ['Copy client summary','WhatsApp client','Copy phone number','Copy email address'])assert.ok(c.includes(s),s);
 for(const s of ['versionCode = 31','versionName = "0.2.29"','applicationIdSuffix = ".isolated"'])assert.ok(b.includes(s),s);
});

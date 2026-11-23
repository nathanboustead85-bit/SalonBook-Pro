const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('manifest references legacy and Android 12+ backup policy resources',()=>{
 const m=read('app/src/main/AndroidManifest.xml');
 assert.match(m,/android:fullBackupContent="@xml\/boustio_backup_rules"/);
 assert.match(m,/android:dataExtractionRules="@xml\/boustio_data_extraction_rules"/);
});
test('both cloud and device transfer exclude salonbook_data preferences',()=>{
 const legacy=read('app/src/main/res/xml/boustio_backup_rules.xml');
 const modern=read('app/src/main/res/xml/boustio_data_extraction_rules.xml');
 assert.match(legacy,/<exclude domain="sharedpref" path="salonbook_data\.xml"\s*\/>/);
 assert.match(modern,/<cloud-backup>[\s\S]*?<exclude domain="sharedpref" path="salonbook_data\.xml"\s*\/>[\s\S]*?<\/cloud-backup>/);
 assert.match(modern,/<device-transfer>[\s\S]*?<exclude domain="sharedpref" path="salonbook_data\.xml"\s*\/>[\s\S]*?<\/device-transfer>/);
});
test('local booking preferences are actually named salonbook_data',()=>{
 const c=read('app/src/main/java/com/salonbook/pro/CloudActivity.kt');
 assert.match(c,/getSharedPreferences\("salonbook_data", MODE_PRIVATE\)/);
});
test('safety gates still prohibit live release',()=>{
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const x of Object.values(g.gates))assert.equal(x.status,'OPEN');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(g[k],false);
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
test('AI-assisted review records observed Android and Firebase risks without declaring approval',()=>{
 const report=read('docs/security/phase-52-2-ai-assisted-source-review.md');
 for(const id of ['A1','A2','A3','A4','A5','A6','A7'])assert.ok(report.includes(id),id);
 assert.match(report,/NOT an independent professional audit/);
 assert.match(report,/All seven gates remain OPEN/);
});
test('repository Firebase environment difference is explicitly flagged',()=>{
 const google=JSON.parse(read('app/google-services.json'));
 assert.equal(google.project_info.project_id,'salonbook-pro-ad5ff');
 const report=read('docs/security/phase-52-2-ai-assisted-source-review.md');
 assert.match(report,/boustio-staging/);
 assert.match(report,/staging test APK must not silently use production Firebase/);
});
test('review detects backup and destructive restore surfaces',()=>{
 const manifest=read('app/src/main/AndroidManifest.xml');
 const cloud=read('app/src/main/java/com/salonbook/pro/CloudActivity.kt');
 assert.match(manifest,/android:allowBackup="true"/);
 assert.match(cloud,/private fun restore\(\)/);
 assert.match(cloud,/putString\("bookings", bookings\)/);
 assert.match(cloud,/auth\.currentUser!!\.uid/);
});
test('all seven launch gates and live feature restrictions remain in force',()=>{
 assert.equal(Object.keys(gates.gates).length,7);
 for(const g of Object.values(gates.gates)){assert.equal(g.status,'OPEN');assert.equal(g.independentApproval,false)}
 for(const key of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});

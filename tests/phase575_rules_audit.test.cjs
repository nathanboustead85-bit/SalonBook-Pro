const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('emulator success is recorded without treating published rules as verified',()=>{
 const a=JSON.parse(read('security/phase57-5-rules-audit.json'));
 assert.equal(a.sourceRun.conclusion,'success');
 assert.equal(a.sourceRun.job,'firestore-rules-emulator');
 assert.equal(a.deployedRulesComparison.status,'NOT_VERIFIED');
 assert.equal(a.independentApproval,false);
 assert.equal(a.status,'REVIEW_REQUIRED');
});
test('audit accurately reflects version-controlled backup and legacy rules',()=>{
 const rules=read('firestore.rules');
 const a=JSON.parse(read('security/phase57-5-rules-audit.json'));
 assert.equal(a.findings.length,3);
 assert.match(rules,/match \/users\/\{userId\}\/backups\/\{backupId\}/);
 assert.match(rules,/allow read, write: if isOwner\(userId\)/);
 assert.match(rules,/function legacyBookingWriteAllowed\(userId\)/);
 assert.match(rules,/!migrationCompleted\(userId\)/);
 assert.match(rules,/get\(bookingModePath\(userId\)\)\.data\.mode == "legacy"/);
 assert.match(rules,/match \/publicBusinesses\/\{businessId\}/);
 for(const f of a.findings)assert.equal(f.decision,'PENDING');
});
test('all launch gates and appointments remain protected',()=>{
 const a=JSON.parse(read('security/phase57-5-rules-audit.json'));
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const v of Object.values(g.gates))assert.equal(v.status,'OPEN');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement']){
  assert.equal(a[k],false);assert.equal(g[k],false);
 }
 assert.equal(a.originalAndroidAppointments,'DO_NOT_TOUCH');
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const audit=read('docs/security/phase-52-10-consolidated-audit.md');
const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
test('all seven gates remain explicitly open and not independently approved',()=>{
 assert.equal(Object.keys(gates.gates).length,7);
 for(let i=1;i<=7;i++){
  assert.equal(gates.gates['G'+i].status,'OPEN');
  assert.equal(gates.gates['G'+i].independentApproval,false);
  assert.match(audit,new RegExp('G'+i+' \\|[^\\n]*\\| OPEN'));
 }
 assert.equal(gates.approval,'NOT_APPROVED');
});
test('all live changes remain disabled',()=>{
 for(const key of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[key],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
test('report explicitly distinguishes offline preparation from actual recovery and approval',()=>{
 for(const phrase of ['NOT APPROVED FOR RELEASE','not an independent professional security audit','actual rollback/recovery not implemented','Do not merge PR #5'])assert.ok(audit.includes(phrase),phrase);
});
test('critical risks and handover steps are recorded',()=>{
 for(const phrase of ['salonbook-pro-ad5ff','boustio-staging','Phase 53','published rules revision','automatic recovery path'])assert.ok(audit.includes(phrase),phrase);
});

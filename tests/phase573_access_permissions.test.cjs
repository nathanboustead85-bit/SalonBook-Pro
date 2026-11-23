const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
/** Non-authoritative staging-only access model; does not call Firebase. */
function allow({authenticated=false, verified=false, role='customer', actorBusiness=null, targetBusiness=null, environment='staging', action='read'}) {
 if (environment !== 'staging' || !authenticated || !targetBusiness) return false;
 if (actorBusiness !== targetBusiness) return false;
 if (role === 'auditor') return action === 'read';
 if (role !== 'owner') return false;
 return action === 'read' || (action === 'write' && verified);
}
test('anonymous and cross-business access denied', () => {
 assert.equal(allow({targetBusiness:'A'}),false);
 for (const action of ['read','write'])
  assert.equal(allow({authenticated:true,verified:true,role:'owner',actorBusiness:'A',targetBusiness:'B',action}),false);
});
test('owner verification and auditor least privilege enforced by model', () => {
 const base={authenticated:true,role:'owner',actorBusiness:'A',targetBusiness:'A'};
 assert.equal(allow({...base,action:'read'}),true);
 assert.equal(allow({...base,action:'write'}),false);
 assert.equal(allow({...base,verified:true,action:'write'}),true);
 assert.equal(allow({...base,role:'auditor',verified:true,action:'read'}),true);
 assert.equal(allow({...base,role:'auditor',verified:true,action:'write'}),false);
});
test('staging model rejects production target', () => {
 assert.equal(allow({authenticated:true,verified:true,role:'owner',actorBusiness:'A',targetBusiness:'A',environment:'production',action:'write'}),false);
});
test('all seven real-world access scenarios remain unverified', () => {
 const p=JSON.parse(read('security/phase57-3-access-permissions.json'));
 assert.equal(p.scenarios.length,7);
 assert.equal(p.status,'NOT_VERIFIED');
 assert.equal(p.approval,'NOT_APPROVED');
 assert.equal(p.executionAuthorized,false);
 assert.equal(p.productionAccess,false);
 assert.equal(p.stagingAccess,false);
 for (const s of p.scenarios) assert.equal(s.status,'PENDING_REAL_STAGING_EVIDENCE');
});
test('existing gates and Android appointment protection remain intact', () => {
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 const r=JSON.parse(read('security/phase57-1-staging-recovery-readiness.json'));
 const s=JSON.parse(read('security/phase57-2-staging-security-verification.json'));
 const p=JSON.parse(read('security/phase57-3-access-permissions.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const x of Object.values(g.gates)) assert.equal(x.status,'OPEN');
 for(const x of r.prerequisites) assert.equal(x.status,'OPEN');
 for(const x of s.checks) assert.equal(x.status,'OPEN');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement']) {
  assert.equal(g[k],false);
  assert.equal(p[k],false);
 }
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(p.originalAndroidAppointments,'DO_NOT_TOUCH');
});
test('audit states simulation limitations',()=>{
 const doc=read('security/phase57-3-access-permissions.md');
 for(const term of ['NOT VERIFIED','non-authoritative','Firestore','IAM','OPEN','Android appointments'])
  assert.ok(doc.includes(term),term);
});

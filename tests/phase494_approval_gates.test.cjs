'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase494-gates.json'),'utf8'));
const doc=fs.readFileSync(path.join(root,'docs/security/phase-49-4-evidence-and-approval-gates.md'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-494-evidence-gates.yml'),'utf8');
function approved(g){return g.launchBlockers.every(b=>b.status==='CLOSED' && b.evidence==='VERIFIED' && b.independentReviewer && b.approval) && g.independentApproval===true;}
test('seven blockers remain OPEN, evidence pending, approvals absent',()=>{
 assert.equal(gates.launchBlockers.length,7);
 assert.deepEqual(gates.launchBlockers.map(b=>b.id),['LB-1','LB-2','LB-3','LB-4','LB-5','LB-6','LB-7']);
 assert.ok(gates.launchBlockers.every(b=>b.status==='OPEN'&&b.evidence==='PENDING'&&b.independentReviewer===null&&b.approval===null));
 assert.equal(approved(gates),false);
});
test('fail closed on partial or unverified evidence',()=>{
 for(let n=0;n<7;n++){const copy=structuredClone(gates);copy.independentApproval=true;copy.launchBlockers.forEach(b=>Object.assign(b,{status:'CLOSED',evidence:'VERIFIED',independentReviewer:'independent',approval:'authorized'}));copy.launchBlockers[n].evidence='PENDING';assert.equal(approved(copy),false);}
});
test('all live functions and deployment stay disabled; original Android data protected',()=>{
 for(const k of ['productionDeployment','liveBookings','payments','messaging'])assert.equal(gates[k],false);
 assert.equal(gates.androidAppointments,'preserve-existing-two');
});
test('evidence requires independence, negative tests and secure provenance',()=>{
 for(const s of ['independence declaration','negative test','restricted','signed','rollback','Admin SDK bypasses rules'])assert.ok(doc.toLowerCase().includes(s.toLowerCase()),s);
});
test('workflow is read-only and does not expose deployment permissions',()=>{
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/firebase deploy|secrets\.|pull_request_target|id-token: write|contents: write/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const state=JSON.parse(read('security/phase496-staging-readiness.json'));
const gates=JSON.parse(read('security/phase494-gates.json'));
const manifest=JSON.parse(read('security/phase495-evidence-manifest.json'));
const {assessReadiness,REQUIRED}=require('../security/phase496-readiness-validator.cjs');
test('baseline preparation is safe but does not authorize staging or launch',()=>{
 const result=assessReadiness(state);
 assert.equal(result.safePreparation,true);
 assert.equal(result.stagingExecutionAuthorized,false);
 assert.equal(result.launchAuthorized,false);
});
test('attempted self approval or unsafe flags fail closed',()=>{
 const mutations=[s=>s.status='APPROVED',s=>s.executionMode='real-staging',s=>s.stagingProjectId='prod-project',s=>s.launchBlockers='CLOSED',s=>s.androidAppointments='overwrite',...REQUIRED.map(field=>s=>s[field]=true),...['liveBookings','payments','messaging','deployment'].map(field=>s=>s[field]=true)];
 for(const mutate of mutations){const copy=structuredClone(state);mutate(copy);assert.equal(assessReadiness(copy).safePreparation,false);}
});
test('all seven blockers remain open and no independent evidence is approved',()=>{
 assert.equal(gates.launchBlockers.length,7);
 assert.ok(gates.launchBlockers.every(b=>b.status==='OPEN'&&b.evidence==='PENDING'&&b.approval===null));
 assert.equal(manifest.independentApproval,false);
 assert.ok(manifest.records.every(r=>r.status==='PENDING'));
});
test('independent review plan documents real staging and Admin SDK limitations',()=>{
 const doc=read('docs/security/phase-49-6-staging-verification-plan.md');
 for(const term of ['revokeRefreshTokens','verifyIdToken','Admin SDK bypasses Firestore Rules','independent reviewer','rollback','negative tests','separate authorization','two original Android appointments'])assert.ok(doc.toLowerCase().includes(term.toLowerCase()),term);
});
test('workflow is read only, no secrets, deployment or write permissions',()=>{
 const wf=read('.github/workflows/boustio-phase-496-staging-readiness.yml');
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/firebase deploy|secrets\.|pull_request_target|id-token: write|contents: write/);
});

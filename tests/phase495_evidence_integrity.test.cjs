'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'security/phase495-evidence-manifest.json'),'utf8'));
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase494-gates.json'),'utf8'));
const {validate,sha256}=require('../security/phase495-evidence-validator.cjs');
const sample=Buffer.from('synthetic non-sensitive evidence');
const good={control:'owner-isolation',author:'author-A',reviewer:'reviewer-B',digest:sha256(sample),commit:'a'.repeat(40),runUrl:'https://github.com/example/repo/actions/runs/12345',negativeTestsPassed:true,restrictedStorageConfirmed:true,signedDecision:true};
test('baseline manifest is pending and valid, not approval',()=>{assert.equal(validate(manifest).ok,true);assert.equal(manifest.independentApproval,false);});
test('tampering, missing records and unauthorized approval fail closed',()=>{
 for(const change of [m=>m.records.pop(),m=>m.records[0].status='VERIFIED',m=>m.independentApproval=true,m=>m.environment='production',m=>m.records[1].control=m.records[0].control]){const m=structuredClone(manifest);change(m);assert.equal(validate(m).ok,false);}
});
test('candidate digest, reviewer independence and provenance validation',()=>{
 assert.equal(validate(manifest,{[good.control]:sample},{checkCandidate:good}).ok,true);
 for(const change of [c=>c.reviewer=c.author,c=>c.digest='0'.repeat(64),c=>c.runUrl='https://example.com',c=>c.negativeTestsPassed=false,c=>c.restrictedStorageConfirmed=false,c=>c.signedDecision=false]){const c={...good};change(c);assert.equal(validate(manifest,{[good.control]:sample},{checkCandidate:c}).ok,false);}
 assert.equal(validate(manifest,{[good.control]:Buffer.from('tampered')},{checkCandidate:good}).ok,false);
});
test('all seven launch blockers open and no production features enabled',()=>{
 assert.equal(gates.launchBlockers.length,7);
 assert.ok(gates.launchBlockers.every(b=>b.status==='OPEN'&&b.approval===null));
 for(const key of ['productionDeployment','liveBookings','payments','messaging'])assert.equal(gates[key],false);
 assert.equal(gates.androidAppointments,'preserve-existing-two');
});
test('workflow has read-only token and no privileged deploy',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-495-evidence-integrity.yml'),'utf8');
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/firebase deploy|secrets\.|pull_request_target|id-token: write|contents: write/);
});
